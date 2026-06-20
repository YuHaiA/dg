import { ElMessage, ElMessageBox } from 'element-plus';

export function useDomainDeleteActions({ deleteDomainByName, deleteDomainsByNames }) {
  async function confirmDelete(row) {
    try {
      await ElMessageBox.confirm(`确定删除 ${row.name} 吗？DNS 会立即停用并进入 pendingdelete。`, '确认删除', {
        cancelButtonText: '取消',
        confirmButtonText: '删除',
        type: 'warning'
      });
      await deleteDomainByName(row.name);
    } catch (error) {
      showDeleteError(error, '删除失败');
    }
  }

  async function confirmBatchDelete(rows) {
    const names = rows.map((row) => row.name);
    await confirmDeleteNames(names, `确定删除选中的 ${rows.length} 个域名吗？DNS 会立即停用并进入 pendingdelete。`);
  }

  async function confirmDeleteNames(names, message) {
    try {
      await ElMessageBox.confirm(message, '确认批量删除', {
        cancelButtonText: '取消',
        confirmButtonText: '批量删除',
        type: 'warning'
      });
      await deleteDomainsByNames(names);
      return true;
    } catch (error) {
      showDeleteError(error, '批量删除失败');
      return false;
    }
  }

  return { confirmBatchDelete, confirmDelete, confirmDeleteNames };
}

function showDeleteError(error, fallback) {
  if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || fallback);
}
