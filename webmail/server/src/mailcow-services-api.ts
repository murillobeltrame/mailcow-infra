import {
  assertMailcowSuccess,
  mailcowRequest,
  normalizeMailcowList,
} from "./mailcow-api.js";

async function mcPost(path: string, body?: unknown) {
  const data = await mailcowRequest("POST", path, body);
  assertMailcowSuccess(data);
  return data;
}

async function mcList(path: string) {
  const data = await mailcowRequest<unknown>("GET", path);
  return normalizeMailcowList<Record<string, unknown>>(data);
}

/** Aliases */
export const addAlias = (attrs: Record<string, unknown>) => mcPost("add/alias", attrs);
export const editAlias = (attrs: Record<string, unknown>) => mcPost("edit/alias", attrs);
export const deleteAliases = (addresses: string[]) => mcPost("delete/alias", addresses);
export const addTimeLimitedAlias = (attrs: Record<string, unknown>) =>
  mcPost("add/time_limited_alias", attrs);
export const listTimeLimitedAliases = (mailbox: string) =>
  mcList(`get/time_limited_aliases/${encodeURIComponent(mailbox)}`);

/** Domains */
export const editDomain = (attrs: Record<string, unknown>) => mcPost("edit/domain", attrs);
export const deleteDomains = (domains: string[]) => mcPost("delete/domain", domains);
export const getDomain = (id: string) =>
  mailcowRequest<unknown>("GET", `get/domain/${encodeURIComponent(id)}`);

/** DKIM */
export const getDkim = (domain: string) =>
  mailcowRequest<unknown>("GET", `get/dkim/${encodeURIComponent(domain)}`);
export const addDkim = (attrs: Record<string, unknown>) => mcPost("add/dkim", attrs);
export const deleteDkim = (attrs: Record<string, unknown>) => mcPost("delete/dkim", attrs);

/** Quarantine & mail queue */
export const listQuarantine = () => mcList("get/quarantine/all");
export const deleteQuarantineItems = (ids: string[]) => mcPost("delete/qitem", ids);
export const listMailQueue = () => mcList("get/mailq/all");
export const deleteMailQueue = (items: unknown) => mcPost("delete/mailq", items);
export const editMailQueue = (attrs: Record<string, unknown>) => mcPost("edit/mailq", attrs);

/** Fail2ban */
export const getFail2ban = () => mailcowRequest<unknown>("GET", "get/fail2ban");
export const editFail2ban = (attrs: Record<string, unknown>) => mcPost("edit/fail2ban", attrs);

/** Forward / relay / transport */
export const listFwdHosts = () => mcList("get/fwdhost/all");
export const addFwdHost = (attrs: Record<string, unknown>) => mcPost("add/fwdhost", attrs);
export const deleteFwdHosts = (items: unknown) => mcPost("delete/fwdhost", items);

export const listRelayHosts = () => mcList("get/relayhost/all");
export const addRelayHost = (attrs: Record<string, unknown>) => mcPost("add/relayhost", attrs);
export const deleteRelayHosts = (items: unknown) => mcPost("delete/relayhost", items);

export const listTransports = () => mcList("get/transport/all");
export const addTransport = (attrs: Record<string, unknown>) => mcPost("add/transport", attrs);
export const deleteTransports = (items: unknown) => mcPost("delete/transport", items);

/** Sync jobs & resources */
export const listSyncJobs = () => mcList("get/syncjobs/all/no_log");
export const addSyncJob = (attrs: Record<string, unknown>) => mcPost("add/syncjob", attrs);
export const editSyncJob = (attrs: Record<string, unknown>) => mcPost("edit/syncjob", attrs);
export const deleteSyncJobs = (items: unknown) => mcPost("delete/syncjob", items);

export const listResources = () => mcList("get/resource/all");
export const addResource = (attrs: Record<string, unknown>) => mcPost("add/resource", attrs);
export const deleteResources = (items: unknown) => mcPost("delete/resource", items);

/** Rate limits & spam */
export const getRlDomain = (domain: string) =>
  mailcowRequest<unknown>("GET", `get/rl-domain/${encodeURIComponent(domain)}`);
export const editRlDomain = (attrs: Record<string, unknown>) => mcPost("edit/rl-domain/", attrs);
export const getRlMbox = (mailbox: string) =>
  mailcowRequest<unknown>("GET", `get/rl-mbox/${encodeURIComponent(mailbox)}`);
export const editRlMbox = (attrs: Record<string, unknown>) => mcPost("edit/rl-mbox/", attrs);
export const editSpamScore = (attrs: Record<string, unknown>) => mcPost("edit/spam-score/", attrs);

/** ACL */
export const editUserAcl = (attrs: Record<string, unknown>) => mcPost("edit/user-acl", attrs);
export const editDaAcl = (attrs: Record<string, unknown>) => mcPost("edit/da-acl", attrs);

/** Maps & policies */
export const listBccMaps = () => mcList("get/bcc/all");
export const addBccMap = (attrs: Record<string, unknown>) => mcPost("add/bcc", attrs);
export const deleteBccMaps = (items: unknown) => mcPost("delete/bcc", items);

export const listRecipientMaps = () => mcList("get/recipient_map/all");
export const addRecipientMap = (attrs: Record<string, unknown>) => mcPost("add/recipient_map", attrs);
export const deleteRecipientMaps = (items: unknown) => mcPost("delete/recipient_map", items);

export const listTlsPolicyMaps = () => mcList("get/tls-policy-map/all");
export const addTlsPolicyMap = (attrs: Record<string, unknown>) => mcPost("add/tls-policy-map", attrs);
export const deleteTlsPolicyMaps = (items: unknown) => mcPost("delete/tls-policy-map", items);

export const addDomainPolicy = (attrs: Record<string, unknown>) => mcPost("add/domain-policy", attrs);
export const deleteDomainPolicies = (items: unknown) => mcPost("delete/domain-policy", items);

/** Status & logs */
export const getSolrStatus = () => mailcowRequest<unknown>("GET", "get/status/solr");
export const listLogs = (type: string, count = 50) =>
  mailcowRequest<unknown>("GET", `get/logs/${type}/${count}`);

/** OAuth2 (read/manage) */
export const listOAuth2Clients = () => mcList("get/oauth2-client/all");
export const addOAuth2Client = (attrs: Record<string, unknown>) => mcPost("add/oauth2-client", attrs);
export const deleteOAuth2Clients = (items: unknown) => mcPost("delete/oauth2-client", items);
