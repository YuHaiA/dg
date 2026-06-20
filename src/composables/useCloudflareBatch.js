import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  addCfZone,
  deleteCfZoneSmart,
  getCfAccounts,
  getDomainCfAccountLabel,
  hasCloudflareNameservers,
  lookupCfZone,
  rememberDomainCfAccount
} from '../api/cloudflare';

export function useCloudflareBatch({ loadDomains, updateNameserversByName }) {
  const cfBatching = ref(false);

  async function syncCfAccounts(rows) {
    const accounts = getCfAccounts();
    if (!accounts.length) {
      ElMessage.warning('请先配置 Cloudflare 账号');
      return;
    }
    cfBatching.value = true;
    let synced = 0;
    try {
      for (const row of rows) {
        if (!shouldLookup(row)) continue;
        const account = await findDomainAccount(row.name, accounts);
        if (account) {
          rememberDomainCfAccount(row.name, account);
          synced += 1;
        }
      }
      ElMessage.success(`已同步 ${synced} 个 CF 状态`);
    } finally {
      cfBatching.value = false;
    }
  }

  function shouldLookup(row) {
    return hasCloudflareNameservers(row.nameservers) && !getDomainCfAccountLabel(row.name);
  }

  async function findDomainAccount(domain, accounts) {
    for (const account of accounts) {
      try {
        const result = await lookupCfZone(domain, account);
        if (result?.data?.[0]?.found) return account;
      } catch (error) {}
    }
    return null;
  }

  async function confirmBatchHostCf(rows) {
    try {
      await ElMessageBox.confirm(
        `确定将选中的 ${rows.length} 个域名添加到 Cloudflare，并把返回的 NS 写回官网吗？`,
        '批量添加到 CF',
        { cancelButtonText: '取消', confirmButtonText: '开始添加', type: 'warning' }
      );
      await runBatchHost(rows);
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '批量添加到 CF 失败');
    }
  }

  async function runBatchHost(rows) {
    cfBatching.value = true;
    const failed = [];
    let skipped = 0;
    let success = 0;
    try {
      for (const row of rows) {
        if (hasCloudflareNameservers(row.nameservers)) {
          skipped += 1;
          continue;
        }
        const ok = await hostOne(row.name);
        if (ok) success += 1;
        else failed.push(row.name);
      }
      await loadDomains();
      showBatchHostResult({ failed, skipped, success });
    } finally {
      cfBatching.value = false;
    }
  }

  async function hostOne(domain) {
    try {
      const result = await addCfZone(domain);
      const nameservers = result?.data?.[0]?.name_servers || [];
      if (!nameservers.length) throw new Error('Cloudflare 未返回 NS');
      await updateNameserversByName(domain, nameservers);
      rememberDomainCfAccount(domain);
      return true;
    } catch (error) {
      return false;
    }
  }

  function showBatchHostResult({ failed, skipped, success }) {
    const summary = `成功 ${success} 个，跳过 ${skipped} 个`;
    if (failed.length) {
      ElMessage.warning(`${summary}，失败 ${failed.length} 个：${failed.join(', ')}`);
      return;
    }
    ElMessage.success(`${summary}，已写入 CF NS`);
  }

  async function confirmBatchDeleteCf(rows) {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${rows.length} 个域名的 Cloudflare 托管吗？`, '批量删除 CF 托管', {
        cancelButtonText: '取消',
        confirmButtonText: '删除托管',
        type: 'warning'
      });
      await runBatchDelete(rows);
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '批量删除 CF 托管失败');
    }
  }

  async function runBatchDelete(rows) {
    cfBatching.value = true;
    const failed = [];
    try {
      for (const row of rows) {
        try {
          await deleteCfZoneSmart(row.name);
        } catch (error) {
          failed.push(`${row.name}（${error.message}）`);
        }
      }
      if (failed.length) ElMessage.warning(`部分删除失败：${failed.join(', ')}`);
      else ElMessage.success(`已删除 ${rows.length} 个 CF 托管`);
    } finally {
      cfBatching.value = false;
    }
  }

  return { cfBatching, confirmBatchDeleteCf, confirmBatchHostCf, syncCfAccounts };
}
