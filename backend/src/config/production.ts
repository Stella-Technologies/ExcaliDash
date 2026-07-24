export type ProductionValidationConfig = {
  jwtSecret: string;
  apiKeyHashPepper: string | null;
  oidc: {
    enabled: boolean;
    redirectUri: string | null;
  };
};

export const validateProductionConfig = (config: ProductionValidationConfig): void => {
  const normalizedSecret = config.jwtSecret.trim();
  const insecureJwtSecretPlaceholders = new Set([
    "your-secret-key-change-in-production",
    "change-this-secret-in-production-min-32-chars",
  ]);

  if (config.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long in production");
  }
  if (insecureJwtSecretPlaceholders.has(normalizedSecret)) {
    throw new Error("JWT_SECRET must be changed from placeholder/default value in production");
  }
  if (!config.apiKeyHashPepper || config.apiKeyHashPepper.trim().length === 0) {
    throw new Error("API_KEY_HASH_PEPPER is required in production");
  }
  if (config.apiKeyHashPepper.trim() === "api-key-hash-pepper") {
    throw new Error("API_KEY_HASH_PEPPER must be changed from default value in production");
  }
  if (config.oidc.enabled && config.oidc.redirectUri && !/^https:\/\//i.test(config.oidc.redirectUri)) {
    throw new Error("OIDC_REDIRECT_URI must be HTTPS in production");
  }
};
