"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderError = void 0;
class ProviderError extends Error {
    statusCode;
    provider;
    constructor(message, statusCode, provider) {
        super(message);
        this.statusCode = statusCode;
        this.provider = provider;
    }
}
exports.ProviderError = ProviderError;
//# sourceMappingURL=AppError.js.map