import { PROD_BACKEND } from './hardDataUrls';

export const MCP_SERVER_NAME = 'serpico-public';
export const MCP_URL = `${PROD_BACKEND}/mcp`;

export const MCP_SERVER_CONFIG = { url: MCP_URL };

export const MCP_JSON = JSON.stringify(
  {
    mcpServers: {
      [MCP_SERVER_NAME]: MCP_SERVER_CONFIG,
    },
  },
  null,
  2
);

export function cursorMcpInstallHref(): string {
  const config = btoa(JSON.stringify(MCP_SERVER_CONFIG));
  const name = encodeURIComponent(MCP_SERVER_NAME);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${encodeURIComponent(config)}`;
}
