<template>
  <div class="page-stack cf-page">
    <section class="command-strip">
      <div>
        <p class="eyebrow">Cloudflare</p>
        <h2>Cloudflare 托管</h2>
        <p class="hero-copy">切换账号后查看当前 CF 下的托管域名，可添加或删除托管。</p>
      </div>
      <el-space>
        <el-select
          v-model="activeId"
          class="cf-account-select"
          placeholder="选择 CF 账号"
          @change="switchAccount"
        >
          <el-option v-for="item in accounts" :key="item.id" :label="item.email" :value="item.id" />
        </el-select>
        <el-button :icon="RefreshCw" :loading="zoneLoading" plain @click="loadZones">刷新托管</el-button>
      </el-space>
    </section>

    <section class="workspace-panel cf-account-panel">
      <div class="toolbar">
        <div>
          <h3>账号配置</h3>
          <p>{{ accounts.length }} 个账号，本地配置文件保存</p>
        </div>
        <el-button type="primary" plain @click="saveAccounts">保存账号</el-button>
      </div>

      <el-table :data="accounts" size="small" empty-text="还没有账号">
        <el-table-column label="默认" width="68" align="center">
          <template #default="{ row }">
            <el-radio v-model="activeId" :label="row.id" @change="switchAccount"><span></span></el-radio>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="110" />
        <el-table-column prop="email" label="邮箱" min-width="150" />
        <el-table-column prop="authType" label="认证" width="96" align="center">
          <template #default="{ row }">
            <el-tag effect="plain">{{ row.authType === 'global' ? 'Global' : 'Token' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88" align="center">
          <template #default="{ row }">
            <el-tag :type="row.configured ? 'success' : 'warning'" effect="light" round>
              {{ row.configured ? '已保存' : '缺少 Key' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="76" align="center">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeAccount(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-form :model="form" label-position="top" class="cf-form">
        <el-form-item label="认证方式">
          <el-segmented v-model="form.authType" :options="authTypeOptions" />
        </el-form-item>
        <el-form-item label="CF 邮箱">
          <el-input v-model="form.email" clearable :disabled="form.authType === 'token'" placeholder="name@example.com" />
        </el-form-item>
        <el-form-item label="Account ID">
          <el-input v-model="form.accountId" clearable placeholder="可选，添加托管时使用" />
        </el-form-item>
        <el-form-item :label="form.authType === 'token' ? 'API Token' : 'Global API Key'">
          <el-input
            v-model="form.apiKey"
            show-password
            :placeholder="form.authType === 'token' ? 'cfut_...' : 'Cloudflare Global API Key'"
          />
        </el-form-item>
        <el-button :icon="Plus" class="cf-add-button" @click="addAccount">添加账号</el-button>
      </el-form>
    </section>

    <section class="workspace-panel cf-zone-panel">
      <div class="toolbar">
        <div>
          <h3>托管域名</h3>
          <p>{{ filteredZones.length }} / {{ zones.length }} 个域名，当前账号：{{ activeAccountLabel }}</p>
        </div>
        <el-space>
          <el-input v-model="zoneKeyword" clearable class="cf-search-input" placeholder="搜索域名" />
          <el-input v-model="addDomainText" clearable class="cf-add-domain-input" placeholder="example.com, a.com" />
          <el-button type="primary" :icon="Plus" :loading="hosting" @click="hostDomains">添加到 CF</el-button>
        </el-space>
      </div>

      <div v-if="selectedZones.length" class="cf-batch-bar">
        <span>已选 {{ selectedZones.length }} 个托管域名</span>
        <el-button :icon="Trash2" type="danger" plain :loading="batching" @click="deleteSelectedZones">批量删除托管</el-button>
      </div>

      <el-table
        v-loading="zoneLoading"
        :data="filteredZones"
        class="cf-zone-table"
        empty-text="当前账号还没有托管域名"
        height="max(260px, calc(100vh - 514px))"
        size="small"
        stripe
        @selection-change="selectedZones = $event"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column label="域名" min-width="210">
          <template #default="{ row }">
            <div class="domain-cell">
              <span class="domain-dot"></span>
              <div>
                <strong>{{ row.name }}</strong>
                <span>{{ row.type || 'full' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'warning'" effect="light" round>
              {{ row.status || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="名称服务器" min-width="260">
          <template #default="{ row }">
            <el-tooltip placement="top" :content="formatNameservers(row.name_servers)">
              <div class="ns-list">
                <el-tag v-for="item in visibleNameservers(row.name_servers)" :key="item" effect="plain" class="ns-tag">
                  {{ item }}
                </el-tag>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="创建日期" width="112">
          <template #default="{ row }">{{ formatDate(row.created_on) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="96" align="center">
          <template #default="{ row }">
            <el-button link type="danger" :icon="Trash2" @click="deleteZone(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
import {
  addCfZone,
  deleteCfZone,
  forgetDomainCfAccount,
  getActiveCfAccountId,
  getCfAccounts,
  listCfZones,
  loadCfConfig,
  rememberDomainCfAccount,
  saveCfAccounts
} from '../api/cloudflare';
import { parseDomainList } from '../utils/domainList';

const accounts = ref([]);
const activeId = ref('');
const zones = ref([]);
const zoneKeyword = ref('');
const zoneLoading = ref(false);
const hosting = ref(false);
const batching = ref(false);
const addDomainText = ref('');
const selectedZones = ref([]);
const form = reactive({ authType: 'token', email: '', accountId: '', apiKey: '' });
const authTypeOptions = [
  { label: 'API Token', value: 'token' },
  { label: 'Global Key', value: 'global' }
];

const activeAccount = computed(() => accounts.value.find((item) => item.id === activeId.value) || accounts.value[0] || null);
const activeAccountLabel = computed(() => activeAccount.value?.email || '未选择');
const filteredZones = computed(() => {
  const keyword = zoneKeyword.value.trim().toLowerCase();
  if (!keyword) return zones.value;
  return zones.value.filter((item) => item.name.toLowerCase().includes(keyword));
});

async function loadAccounts(options = {}) {
  await loadCfConfig();
  accounts.value = getCfAccounts();
  activeId.value = getActiveCfAccountId() || accounts.value[0]?.id || '';
  if (options.loadZones !== false) await loadZones();
}

async function loadZones() {
  if (!activeAccount.value) {
    zones.value = [];
    return;
  }

  zoneLoading.value = true;
  try {
    const result = await listCfZones(activeAccount.value);
    zones.value = result?.data || [];
  } catch (error) {
    zones.value = [];
    ElMessage.error(error.message || '加载 CF 托管域名失败');
  } finally {
    zoneLoading.value = false;
  }
}

function resetForm() {
  form.authType = 'token';
  form.email = '';
  form.accountId = '';
  form.apiKey = '';
}

async function addAccount() {
  if (!form.apiKey.trim() || (form.authType === 'global' && !form.email.trim())) {
    ElMessage.warning(form.authType === 'token' ? '请填写 API Token' : '请填写 CF 邮箱和 API Key');
    return;
  }
  const id = createAccountId();
  const label = form.authType === 'token' ? `API Token ${accounts.value.length + 1}` : form.email.trim();
  accounts.value.push({
    id,
    name: form.email.trim() || label,
    email: form.email.trim(),
    authType: form.authType,
    accountId: form.accountId.trim(),
    apiKey: form.apiKey.trim(),
    configured: true
  });
  activeId.value = id;
  await saveAccounts({ silent: true });
  resetForm();
  ElMessage.success('Cloudflare 账号已添加');
  await loadZones();
}

async function removeAccount(id) {
  try {
    await ElMessageBox.confirm('确定删除这个 Cloudflare 账号配置吗？', '删除账号', {
      cancelButtonText: '取消',
      confirmButtonText: '删除',
      type: 'warning'
    });
    accounts.value = accounts.value.filter((item) => item.id !== id);
    if (activeId.value === id) activeId.value = accounts.value[0]?.id || '';
    await saveAccounts({ silent: true });
    ElMessage.success('Cloudflare 账号已删除');
    await loadZones();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除账号失败');
  }
}

async function saveAccounts(options = {}) {
  const normalized = accounts.value.map((item) => ({ ...item, name: item.email || item.name }));
  accounts.value = normalized;
  await saveCfAccounts(normalized, activeId.value);
  await loadAccounts({ loadZones: false });
  if (!options.silent) ElMessage.success('Cloudflare 账号已保存');
}

async function switchAccount() {
  await saveAccounts({ silent: true });
  await loadZones();
}

async function hostDomains() {
  const domains = parseDomainList(addDomainText.value).map(cleanDomain).filter(Boolean);
  if (!domains.length) {
    ElMessage.warning('请输入要托管的域名');
    return;
  }
  if (!activeAccount.value) {
    ElMessage.warning('请先配置 Cloudflare 账号');
    return;
  }

  hosting.value = true;
  const failed = [];
  let success = 0;
  try {
    for (const domain of domains) {
      try {
        await addCfZone(domain, activeAccount.value);
        await rememberDomainCfAccount(domain, activeAccount.value);
        success += 1;
      } catch (error) {
        failed.push(`${domain}（${error.message}）`);
      }
    }
    addDomainText.value = '';
    await loadZones();
    showBatchResult('添加', success, failed);
  } finally {
    hosting.value = false;
  }
}

async function deleteSelectedZones() {
  const rows = [...selectedZones.value];
  if (!rows.length) return;
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${rows.length} 个 Cloudflare 托管吗？`, '批量删除 CF 托管', {
      cancelButtonText: '取消',
      confirmButtonText: '批量删除',
      type: 'warning'
    });
    batching.value = true;
    const failed = [];
    let success = 0;
    for (const row of rows) {
      try {
        await deleteCfZone(row.name, activeAccount.value);
        await forgetDomainCfAccount(row.name);
        success += 1;
      } catch (error) {
        failed.push(`${row.name}（${error.message}）`);
      }
    }
    selectedZones.value = [];
    await loadZones();
    showBatchResult('删除', success, failed);
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '批量删除 CF 托管失败');
  } finally {
    batching.value = false;
  }
}

function cleanDomain(value) {
  return String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function showBatchResult(action, success, failed) {
  if (failed.length) {
    ElMessage.warning(`${action}成功 ${success} 个，失败 ${failed.length} 个：${failed.join(', ')}`);
    return;
  }
  ElMessage.success(`${action}成功 ${success} 个`);
}

async function deleteZone(row) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.name} 的 Cloudflare 托管吗？`, '删除 CF 托管', {
      cancelButtonText: '取消',
      confirmButtonText: '删除托管',
      type: 'warning'
    });
    await deleteCfZone(row.name, activeAccount.value);
    await forgetDomainCfAccount(row.name);
    ElMessage.success('Cloudflare 托管已删除');
    await loadZones();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除 CF 托管失败');
  }
}

function createAccountId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function formatNameservers(list) {
  return Array.isArray(list) && list.length ? list.join(', ') : '-';
}

function visibleNameservers(list) {
  return Array.isArray(list) && list.length ? list.slice(0, 2) : ['-'];
}

onMounted(loadAccounts);
</script>
