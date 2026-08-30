import type { SourceAdapter } from "../application/ports";
import type { SourceAdapterKind } from "../domain/entities";

export class SourceAdapterRegistry {
  private readonly adapters: Map<SourceAdapterKind, SourceAdapter>;

  constructor(adapters: SourceAdapter[]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.kind, adapter]));
  }

  get(kind: SourceAdapterKind) {
    const adapter = this.adapters.get(kind);
    if (!adapter) throw new Error(`Unsupported source adapter: ${kind}`);
    return adapter;
  }
}
