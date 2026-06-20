import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { deleteCfZoneSmart } from '../api/cloudflare';
import { parseDomainList } from '../utils/domainList';

export function usePasteDeleteFlow({ deleteDomainsByNames }) {
  const pasteDeleteCf = ref(false);
  const pasteDeleting = ref(false);
  const pasteDeleteDialogVisible = ref(false);
  const pasteDeleteText = ref('');

  function openPasteDeleteDialog() {
    pasteDeleteText.value = '';
    pasteDeleteCf.value = false;
    pasteDeleteDialogVisible.value = true;
  }

  async function submitPasteDelete() {
    const names = parseDomainList(pasteDeleteText.value);
    if (!names.length) {
      ElMessage.warning('请先粘贴至少一个域名');
      return;
    }

    const confirmed = await confirmPasteDelete(names);
    if (!confirmed) return;
    pasteDeleting.value = true;
    try {
      if (pasteDeleteCf.value) await deleteCloudflareDomains(names);
      await deleteDomainsByNames(names);
      pasteDeleteDialogVisible.value = false;
    } finally {
      pasteDeleting.value = false;
    }
  }

  async function confirmPasteDelete(names) {
    try {
      await ElMessageBox.confirm(buildConfirmText(names.length), '确认批量删除', {
        cancelButtonText: '取消',
        confirmButtonText: '批量删除',
        type: 'warning'
      });
      return true;
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '批量删除失败');
      return false;
    }
  }

  function buildConfirmText(count) {
    const cfText = pasteDeleteCf.value ? '会先删除 Cloudflare 托管，然后' : '';
    return `确定删除这 ${count} 个域名吗？${cfText}DNS 会立即停用并进入 pendingdelete。`;
  }

  async function deleteCloudflareDomains(names) {
    const failed = [];
    for (const name of names) {
      try {
        await deleteCfZoneSmart(name);
      } catch (error) {
        failed.push(`${name}（${error.message}）`);
      }
    }
    if (failed.length) ElMessage.warning(`部分 CF 托管删除失败：${failed.join(', ')}`);
    else ElMessage.success(`已删除 ${names.length} 个 CF 托管`);
  }

  return { openPasteDeleteDialog, pasteDeleteCf, pasteDeleteDialogVisible, pasteDeleteText, pasteDeleting, submitPasteDelete };
}
