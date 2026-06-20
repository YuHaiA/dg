<template>
  <div class="page-stack cf-page">
    <section class="command-strip">
      <div>
        <p class="eyebrow">Cloudflare</p>
        <h2>Cloudflare 托管</h2>
        <p class="hero-copy">这里只管理 CF 账号，域名托管请在域名总览勾选后批量操作。</p>
      </div>
      <el-button type="primary" :icon="RefreshCw" plain @click="loadAccounts">刷新账号</el-button>
    </section>

    <section class="workspace-panel cf-account-panel">
      <div class="toolbar">
        <div>
          <h3>账号管理</h3>
          <p>{{ accounts.length }} 个账号，本地浏览器保存</p>
        </div>
        <el-button type="primary" plain @click="saveAccounts">保存账号</el-button>
      </div>

      <el-table :data="accounts" size="small" empty-text="还没有账号">
        <el-table-column label="默认" width="68" align="center">
          <template #default="{ row }">
            <el-radio v-model="activeId" :label="row.id"><span></span></el-radio>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="110" />
        <el-table-column prop="email" label="邮箱" min-width="150" />
        <el-table-column label="操作" width="76" align="center">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeAccount(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-form :model="form" label-position="top" class="cf-form">
        <el-form-item label="CF 邮箱">
          <el-input v-model="form.email" clearable placeholder="name@example.com" />
        </el-form-item>
        <el-form-item label="Global API Key">
          <el-input v-model="form.apiKey" show-password placeholder="Cloudflare Global API Key" />
        </el-form-item>
        <el-button :icon="Plus" class="cf-add-button" @click="addAccount">添加账号</el-button>
      </el-form>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, RefreshCw } from 'lucide-vue-next';
import { getActiveCfAccountId, getCfAccounts, saveCfAccounts } from '../api/cloudflare';

const accounts = ref([]);
const activeId = ref('');
const form = reactive({ email: '', apiKey: '' });

function loadAccounts() {
  accounts.value = getCfAccounts();
  activeId.value = getActiveCfAccountId() || accounts.value[0]?.id || '';
}

function resetForm() {
  form.email = '';
  form.apiKey = '';
}

function addAccount() {
  if (!form.email.trim() || !form.apiKey.trim()) {
    ElMessage.warning('请填写 CF 邮箱和 API Key');
    return;
  }
  const id = createAccountId();
  accounts.value.push({ id, name: form.email.trim(), email: form.email.trim(), apiKey: form.apiKey.trim() });
  if (!activeId.value) activeId.value = id;
  saveAccounts({ silent: true });
  resetForm();
  ElMessage.success('Cloudflare 账号已添加');
}

function removeAccount(id) {
  accounts.value = accounts.value.filter((item) => item.id !== id);
  if (activeId.value === id) activeId.value = accounts.value[0]?.id || '';
  saveAccounts({ silent: true });
  ElMessage.success('Cloudflare 账号已删除');
}

function saveAccounts(options = {}) {
  const normalized = accounts.value.map((item) => ({ ...item, name: item.email }));
  accounts.value = normalized;
  saveCfAccounts(normalized, activeId.value);
  if (!options.silent) ElMessage.success('Cloudflare 账号已保存');
}

function createAccountId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

onMounted(loadAccounts);
</script>
