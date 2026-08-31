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
      const currentSourceIdentityKeys = entries.map(
        (entry) => entry.identityKey,
      );
      const currentDirectoryIdentityKeys = directoryEntries.map(
        (entry) => entry.identityKey,
      );

      await tx`
        update job_market_sources source set status='revoked',lease_until=null,leased_by=null,updated_at=now()
        from job_market_companies company
        where source.company_id=company.id
          and company.identity_key like 'default:%'
          and not (company.identity_key=any(${currentSourceIdentityKeys}))
          and source.status<>'revoked'`;

      await tx`
        update job_market_campaigns campaign set status='closed',updated_at=now()
        from job_market_companies company
        where campaign.company_id=company.id
          and campaign.listing_kind='recruitment_directory'
          and company.identity_key like 'default:%'
          and not (company.identity_key=any(${currentDirectoryIdentityKeys}))
          and campaign.status<>'closed'`;

      for (const entry of entries) {
        let [company] = await tx<Array<{ id: string }>>`
          insert into job_market_companies(
            canonical_name,normalized_name,company_type,industry,website_url,identity_key
          ) values(
            ${entry.companyName},${normalizeText(entry.companyName)},${entry.companyType},
            ${entry.industry},${entry.websiteUrl},${entry.identityKey}
          ) on conflict(identity_key) do nothing returning id`;
        if (company) createdCompanies += 1;
        else {
          [company] = await tx<Array<{ id: string }>>`
            update job_market_companies set
              canonical_name=${entry.companyName},normalized_name=${normalizeText(entry.companyName)},
              company_type=${entry.companyType},industry=${entry.industry},website_url=${entry.websiteUrl},updated_at=now()
            where identity_key=${entry.identityKey} returning id`;
        }

        let [source] = await tx<Array<{ id: string; status: string }>>`
          insert into job_market_sources(
            company_id,adapter,external_key,base_url,allowed_hosts,is_official,
            access_basis,status,sync_interval_minutes,next_sync_at,country_codes
          ) values(
            ${company.id},${entry.adapter},${entry.externalKey},${entry.baseUrl},${entry.allowedHosts},
            true,'public','active',${entry.syncIntervalMinutes},now(),${entry.countryCodes}
          ) on conflict(company_id,adapter,external_key) do nothing returning id,status::text`;
        if (source) createdSources += 1;
        else {
          [source] = await tx<Array<{ id: string; status: string }>>`
            update job_market_sources set
              base_url=${entry.baseUrl},allowed_hosts=${entry.allowedHosts},is_official=true,
              access_basis='public',sync_interval_minutes=${entry.syncIntervalMinutes},country_codes=${entry.countryCodes},updated_at=now()
            where company_id=${company.id} and adapter=${entry.adapter} and external_key=${entry.externalKey}
            returning id,status::text`;
        }
        if (source.status === "active") activeSourceIds.push(source.id);
      }

      for (const entry of directoryEntries) {
        let [company] = await tx<Array<{ id: string }>>`
          insert into job_market_companies(
            canonical_name,normalized_name,company_type,industry,website_url,identity_key
          ) values(
            ${entry.companyName},${normalizeText(entry.companyName)},${entry.companyType},
            ${entry.industry},${entry.entryUrl},${entry.identityKey}
          ) on conflict(identity_key) do nothing returning id`;
        if (company) createdCompanies += 1;
        else {
          [company] = await tx<Array<{ id: string }>>`
            update job_market_companies set
              canonical_name=${entry.companyName},normalized_name=${normalizeText(entry.companyName)},
              company_type=${entry.companyType},industry=${entry.industry},website_url=${entry.entryUrl},updated_at=now()
            where identity_key=${entry.identityKey} returning id`;
        }

        const campaignKey = `directory:${entry.channel}`;
        await tx`
          update job_market_campaigns set status='closed',updated_at=now()
          where company_id=${company.id}
            and listing_kind='recruitment_directory'
            and campaign_key<>${campaignKey}
            and status<>'closed'`;

        const [campaign] = await tx<Array<{ id: string }>>`
          insert into job_market_campaigns(
            company_id,campaign_key,name,recruitment_type,status,official_apply_url,listing_kind
          ) values(
            ${company.id},${campaignKey},${entry.channelLabel},
            ${entry.channel === "wechat" ? "公众号" : "招聘官网"},'open',${entry.entryUrl},'recruitment_directory'
          ) on conflict(company_id,campaign_key) do nothing returning id`;
        if (campaign) createdDirectoryEntries += 1;
        else {
          await tx`
            update job_market_campaigns set
              name=${entry.channelLabel},recruitment_type=${entry.channel === "wechat" ? "公众号" : "招聘官网"},
              status='open',official_apply_url=${entry.entryUrl},listing_kind='recruitment_directory',
              published_at=null,valid_through=null,last_confirmed_at=null,updated_at=now()
            where company_id=${company.id} and campaign_key=${campaignKey}`;
        }
      }

      return {
        companyCount: entries.length + directoryEntries.length,
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
