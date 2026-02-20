function getSupportConfig() {
  const subdomain = String(process.env.SUPPORT_SUBDOMAIN || "support.tellnab.com").toLowerCase();
  const apiBasePath = String(process.env.SUPPORT_API_BASE_PATH || "/api");
  const assetBaseUrl = String(process.env.SUPPORT_ASSET_BASE_URL || `https://${subdomain}`);

  return {
    subdomain,
    apiBasePath,
    assetBaseUrl,
  };
}

module.exports = {
  getSupportConfig,
};
