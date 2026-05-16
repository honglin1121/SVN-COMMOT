export class ProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly provider?: string
  ) {
    super(message);
  }
}
