import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  deleteDomain,
  getApiStatus,
  getStoredApiKey,
  listDomains,
  registerDomain,
  setStoredApiKey,
  updateNameservers
} from '../api/digitalplat';

const apiReady = ref(false);
const loading = ref(false);
const saving = ref(false);
const savingNs = ref(false);
const domains = ref([]);
const activeDomain = ref(null);
const apiKey = ref(getStoredApiKey());

function parseError(error) {
  return error?.message || '请求失败';
}

function randomPrefix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const length = 5 + Math.floor(Math.random() * 4);
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

export function useDomainConsole() {
  async function loadApiStatus() {
    try {
      const result = await getApiStatus();
      apiReady.value = Boolean(result?.data?.apiConfigured);
    } catch (error) {
      apiReady.value = false;
      ElMessage.error(parseError(error));
    }
  }

  async function saveApiKey(value) {
    setStoredApiKey(value);
    apiKey.value = getStoredApiKey();
    apiReady.value = Boolean(apiKey.value);
    if (apiReady.value) await loadDomains();
    else domains.value = [];
  }

  async function loadDomains() {
    if (!apiReady.value) return;
    loading.value = true;
    try {
      const result = await listDomains();
      domains.value = result?.data || [];
    } catch (error) {
      ElMessage.error(parseError(error));
    } finally {
      loading.value = false;
    }
  }

  async function registerNewDomain(payload) {
    saving.value = true;
    try {
      await registerDomain(payload);
      ElMessage.success('域名已提交注册');
      await loadDomains();
    } catch (error) {
      ElMessage.error(parseError(error));
      throw error;
    } finally {
      saving.value = false;
    }
  }

  async function registerDomainsBatch(config) {
    saving.value = true;
    const registered = [];
    const used = new Set(domains.value.map((item) => item.name));
    const maxAttempts = Math.max(config.count * 20, 50);
    try {
      for (let attempt = 0; registered.length < config.count && attempt < maxAttempts; attempt += 1) {
        const domain = `${randomPrefix()}.${config.suffix}`;
        if (used.has(domain)) continue;
        used.add(domain);
        try {
          await registerDomain({ domain, slot_type: config.slot_type, nameservers: config.nameservers });
          registered.push(domain);
        } catch (error) {}
      }
      await loadDomains();
      if (registered.length < config.count) throw new Error(`已注册 ${registered.length} 个，未达到目标数量`);
      ElMessage.success(`已注册 ${registered.length} 个域名`);
    } catch (error) {
      ElMessage.error(parseError(error));
      throw error;
    } finally {
      saving.value = false;
    }
  }

  async function updateDomainNameservers(nameservers) {
    if (!activeDomain.value) return;
    savingNs.value = true;
    try {
      await updateNameservers(activeDomain.value.name, nameservers);
      ElMessage.success('名称服务器已更新');
      await loadDomains();
    } catch (error) {
      ElMessage.error(parseError(error));
    } finally {
      savingNs.value = false;
    }
  }

  async function updateNameserversByName(domain, nameservers) {
    await updateNameservers(domain, nameservers);
  }

  async function deleteDomainByName(name) {
    await deleteDomain(name);
    ElMessage.success('域名已进入 pendingdelete');
    await loadDomains();
  }

  async function deleteDomainsByNames(names) {
    loading.value = true;
    try {
      await Promise.all(names.map((name) => deleteDomain(name)));
      ElMessage.success(`已删除 ${names.length} 个域名`);
      await loadDomains();
    } catch (error) {
      ElMessage.error(parseError(error));
      throw error;
    } finally {
      loading.value = false;
    }
  }

  return {
    activeDomain,
    apiKey,
    apiReady,
    deleteDomainByName,
    deleteDomainsByNames,
    domains,
    loadApiStatus,
    loadDomains,
    loading,
    registerDomainsBatch,
    registerNewDomain,
    saveApiKey,
    saving,
    savingNs,
    updateNameserversByName,
    updateDomainNameservers
  };
}
