import { createServerDatabase } from "@/shared/database";
import { normalizeText } from "../domain/normalization";
import type { DefaultSourceCatalogEntry } from "../application/default-source-catalog";
import type { DefaultCompanyDirectoryEntry } from "../application/default-company-directory";

type Sql = ReturnType<typeof createServerDatabase>;

export type CatalogInitializationResult = {
  companyCount: number;
  sourceCount: number;
  createdCompanies: number;
  createdSources: number;
  directoryCount: number;
  createdDirectoryEntries: number;
  activeSourceIds: string[];
};

export class PostgresSourceCatalogRepository {
  constructor(private readonly sql: Sql = createServerDatabase()) {}

  async initialize(
    entries: readonly DefaultSourceCatalogEntry[],
    directoryEntries: readonly DefaultCompanyDirectoryEntry[],
  ): Promise<CatalogInitializationResult> {
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      let createdCompanies = 0;
      let createdSources = 0;
      let createdDirectoryEntries = 0;
      const activeSourceIds: string[] = [];
      const currentDirectoryIdentityKeys = directoryEntries.map(
        (entry) => entry.identityKey,
      );

      await tx`
        update job_market_campaigns campaign set status='closed',updated_at=now()
        from job_market_companies company
        where campaign.company_id=company.id
          and campaign.listing_kind='recruitment_directory'
          and company.identity_key like 'default:%'
          and not (company.identity_key=any(${currentDirectoryIdentityKeys}))
          and campaign.status<>'closed'`;

      for (const entry of entries) {
        // Multiple sources share a company only through an explicit, stable
        // identity. A display name alone cannot identify a legal entity.
        const companyIdentityKey =
          entry.companyIdentityKey ?? entry.identityKey;
        let [company] = await tx<Array<{ id: string }>>`
          select id from job_market_companies
          where identity_key=${companyIdentityKey}
          limit 1`;
        if (company) {
          await tx`
            update job_market_companies set
              canonical_name=${entry.companyName},
              company_type=${entry.companyType},industry=${entry.industry},
              website_url=${entry.websiteUrl},updated_at=now()
            where id=${company.id}`;
        } else {
          createdCompanies += 1;
          [company] = await tx<Array<{ id: string }>>`
            insert into job_market_companies(
              canonical_name,normalized_name,company_type,industry,website_url,identity_key
            ) values(
              ${entry.companyName},${normalizeText(entry.companyName)},${entry.companyType},
              ${entry.industry},${entry.websiteUrl},${companyIdentityKey}
            ) returning id`;
        }

        let [source] = await tx<Array<{ id: string; status: string }>>`
          select source.id,source.status::text
          from job_market_sources source
          where source.catalog_key=${entry.identityKey}
            or (
              source.catalog_key is null
              and source.adapter=${entry.adapter}
              and source.external_key=${entry.externalKey}
            )
          order by case when source.catalog_key=${entry.identityKey} then 0 else 1 end
          limit 1 for update of source`;
        if (source) {
          [source] = await tx<Array<{ id: string; status: string }>>`
            update job_market_sources set
              company_id=${company.id},catalog_key=${entry.identityKey},adapter=${entry.adapter},
              external_key=${entry.externalKey},base_url=${entry.baseUrl},allowed_hosts=${entry.allowedHosts},
              is_official=true,access_basis='public',sync_interval_minutes=${entry.syncIntervalMinutes},
              country_codes=${entry.countryCodes},updated_at=now()
            where id=${source.id} returning id,status::text`;
        } else {
          createdSources += 1;
          [source] = await tx<Array<{ id: string; status: string }>>`
            insert into job_market_sources(
              company_id,catalog_key,adapter,external_key,base_url,allowed_hosts,is_official,
              access_basis,status,sync_interval_minutes,next_sync_at,country_codes
            ) values(
              ${company.id},${entry.identityKey},${entry.adapter},${entry.externalKey},${entry.baseUrl},${entry.allowedHosts},
              true,'public','active',${entry.syncIntervalMinutes},now(),${entry.countryCodes}
            ) returning id,status::text`;
        }
        if (source.status === "active") activeSourceIds.push(source.id);
      }

      const sourceCatalogPayload = entries.map((entry) => ({
        identity_key: entry.identityKey,
        adapter: entry.adapter,
        external_key: entry.externalKey,
      }));
      const [obsolete] = await tx<Array<{ ids: string[]; runIds: string[] }>>`
        with input as (
          select * from jsonb_to_recordset(${tx.json(sourceCatalogPayload as never)}::jsonb) as value(
            identity_key text,adapter job_market_source_adapter,external_key text
          )
        ), obsolete as (
          select source.id,source.lease_run_id
          from job_market_sources source
          join job_market_companies company on company.id=source.company_id
          where (
            source.catalog_key is not null
            and not exists(select 1 from input where input.identity_key=source.catalog_key)
          ) or (
            source.catalog_key is null
            and company.identity_key like 'default:%'
            and not exists(
              select 1 from input where input.adapter=source.adapter
                and input.external_key=source.external_key
            )
          )
        )
        select coalesce(array_agg(id),'{}') ids,
          coalesce(array_agg(lease_run_id) filter(where lease_run_id is not null),'{}') as run_ids
        from obsolete`;
      if (obsolete.runIds.length) {
        await tx`update job_market_sync_runs set status='failed',finished_at=greatest(started_at,now()),
          error_code='source_disabled',error_summary='The source was removed from the default catalog.'
          where id=any(${obsolete.runIds}::uuid[]) and status='running'`;
      }
      if (obsolete.ids.length) {
        await tx`update job_market_sources set status='revoked',lease_until=null,leased_by=null,
          lease_run_id=null,updated_at=now() where id=any(${obsolete.ids}::uuid[])`;
      }

      if (directoryEntries.length) {
        const directoryPayload = directoryEntries.map((entry) => ({
          identity_key: entry.identityKey,
          company_name: entry.companyName,
          normalized_name: normalizeText(entry.companyName),
          company_type: entry.companyType,
          industry: entry.industry,
          channel: entry.channel,
          channel_label: entry.channelLabel,
          entry_url: entry.entryUrl,
          published_at: entry.publishedAt ?? null,
        }));
        const directoryJson = tx.json(directoryPayload as never);
        const [existing] = await tx<
          Array<{ campaigns: number; companies: number }>
        >`
          with input as (
            select * from jsonb_to_recordset(${directoryJson}::jsonb) as value(
              identity_key text,channel text
            )
          )
          select
            (select count(*)::int from job_market_companies company
              join input on input.identity_key=company.identity_key) companies,
            (select count(*)::int from job_market_campaigns campaign
              join job_market_companies company on company.id=campaign.company_id
              join input on input.identity_key=company.identity_key
              where campaign.campaign_key='directory:' || input.channel) campaigns`;
        createdCompanies += directoryEntries.length - existing.companies;
        createdDirectoryEntries += directoryEntries.length - existing.campaigns;

        await tx`
          with input as (
            select * from jsonb_to_recordset(${directoryJson}::jsonb) as value(
              identity_key text,company_name text,normalized_name text,company_type text,
              industry text,entry_url text
            )
          )
          insert into job_market_companies(
            canonical_name,normalized_name,company_type,industry,website_url,identity_key
          )
          select company_name,normalized_name,company_type,industry,entry_url,identity_key
          from input
          on conflict(identity_key) do update set
            canonical_name=excluded.canonical_name,normalized_name=excluded.normalized_name,
            company_type=excluded.company_type,industry=excluded.industry,
            website_url=excluded.website_url,updated_at=now()`;

        await tx`
          with input as (
            select * from jsonb_to_recordset(${directoryJson}::jsonb) as value(
              identity_key text,channel text
            )
          )
          update job_market_campaigns campaign set status='closed',updated_at=now()
          from job_market_companies company,input
          where company.identity_key=input.identity_key
            and campaign.company_id=company.id
            and campaign.listing_kind='recruitment_directory'
            and campaign.campaign_key<>'directory:' || input.channel
            and campaign.status<>'closed'`;

        await tx`
          with input as (
            select * from jsonb_to_recordset(${directoryJson}::jsonb) as value(
              identity_key text,channel text,channel_label text,entry_url text,
              published_at timestamptz
            )
          )
          insert into job_market_campaigns(
            company_id,campaign_key,name,recruitment_type,status,official_apply_url,
            listing_kind,published_at
          )
          select company.id,'directory:' || input.channel,input.channel_label,
            case when input.channel='wechat' then '公众号' else '招聘官网' end,
            'open',input.entry_url,'recruitment_directory',input.published_at
          from input
          join job_market_companies company on company.identity_key=input.identity_key
          on conflict(company_id,campaign_key) do update set
            name=excluded.name,recruitment_type=excluded.recruitment_type,status='open',
            official_apply_url=excluded.official_apply_url,
            listing_kind='recruitment_directory',published_at=excluded.published_at,
            valid_through=null,last_confirmed_at=null,updated_at=now()`;
      }

      return {
        companyCount: new Set([
          ...entries.map(
            (entry) => entry.companyIdentityKey ?? entry.identityKey,
          ),
          ...directoryEntries.map((entry) => entry.identityKey),
        ]).size,
        sourceCount: entries.length,
        createdCompanies,
        createdSources,
        directoryCount: directoryEntries.length,
        createdDirectoryEntries,
        activeSourceIds,
      };
    }) as Promise<CatalogInitializationResult>;
  }
}
