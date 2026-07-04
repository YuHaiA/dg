<template>
  <el-config-provider size="small">
    <div v-if="!authChecked" class="boot-screen">
      <el-icon class="is-loading"><RefreshCw /></el-icon>
    </div>
    <LoginPage v-else-if="!authenticated" :initialized="authInitialized" :loading="authLoading" @submit="submitAuth" />

    <el-container v-else class="app-shell">
      <el-container>
        <el-header class="topbar">
          <div class="topbar-left">
            <el-button :icon="Menu" class="menu-button" @click="navOpen = true" />
            <div>
              <el-breadcrumb separator="/">
                <el-breadcrumb-item>控制台</el-breadcrumb-item>
                <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
              </el-breadcrumb>
              <h1>{{ pageTitle }}</h1>
            </div>
          </div>
          <el-space>
            <el-button v-if="activePage === 'domains'" :icon="RefreshCw" :loading="loading || cfBatching" @click="loadDomains">
              整理
            </el-button>
            <el-button v-else type="primary" :icon="ArrowLeft" plain @click="activePage = 'domains'">
              返回总览
            </el-button>
          </el-space>
        </el-header>

        <el-main class="main">
          <DomainsPage
            v-if="activePage === 'domains'"
            :domains="domains"
            :loading="loading || cfBatching"
            @batch-delete="confirmBatchDelete"
            @batch-delete-cf="confirmBatchDeleteCf"
            @batch-host-cf="confirmBatchHostCf"
            @copy-selected="copySelectedDomains"
            @delete-cf="confirmDeleteCf"
            @delete-domain="confirmDelete"
            @paste-delete="openPasteDeleteDialog"
            @refresh="loadDomains"
            @register="activePage = 'register'"
            @sync-cf="syncCfAccounts"
            @update-ns="openNsDialog"
          />

          <RegisterDomainPage
            v-else-if="activePage === 'register'"
            :api-ready="apiReady"
            :cf-host-domain="hostRegisteredDomain"
            :saving="saving"
            @cancel="activePage = 'domains'"
            @submit="onRegister"
          />

          <CloudflarePage v-else />
        </el-main>
      </el-container>
    </el-container>

    <el-drawer v-model="navOpen" custom-class="nav-drawer" direction="ltr" size="280px" :with-header="false">
      <div class="nav-content">
        <div class="brand">
          <div class="brand-mark">DP</div>
          <div>
            <strong>DigitalPlat</strong>
            <span>域名运营台</span>
          </div>
        </div>

        <el-menu class="side-menu" :default-active="activePage" @select="selectPage">
          <el-menu-item index="domains">
            <el-icon><LayoutDashboard /></el-icon>
            <span>域名总览</span>
          </el-menu-item>
          <el-menu-item index="register">
            <el-icon><SquarePlus /></el-icon>
            <span>注册域名</span>
          </el-menu-item>
          <el-menu-item index="cloudflare">
            <el-icon><Cloud /></el-icon>
            <span>Cloudflare</span>
          </el-menu-item>
        </el-menu>

        <div class="sidebar-status">
          <button class="status-config" type="button" @click="openApiDialog">API 状态</button>
          <el-tag :type="apiReady ? 'success' : 'warning'" effect="dark" round>
            {{ apiReady ? '已连接' : '未配置' }}
          </el-tag>
        </div>
        <el-button class="logout-button" plain @click="logout">退出登录</el-button>
      </div>
    </el-drawer>

    <el-dialog v-model="nsDialogVisible" title="更新名称服务器" width="520px">
      <el-form label-position="top">
        <el-form-item label="目标域名">
          <el-input :model-value="nsTargetText" disabled />
        </el-form-item>
        <el-form-item label="名称服务器">
          <el-input v-model="nsText" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="nsDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingNs" @click="submitNs">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="apiDialogVisible" title="配置 API Key" width="520px">
      <el-form label-position="top">
        <el-form-item label="DigitalPlat API Key">
          <el-input v-model="apiKeyInput" clearable show-password placeholder="dp_live_..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="apiDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitApiKey">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pasteDeleteDialogVisible" title="粘贴批量删除" width="560px">
      <el-form label-position="top">
        <el-form-item label="域名列表">
          <el-input
            v-model="pasteDeleteText"
            type="textarea"
            :rows="6"
            placeholder="支持逗号、空格或换行分隔，例如：a.dpdns.org,b.dpdns.org"
          />
        </el-form-item>
        <p class="dialog-tip">可直接粘贴 `mytuk2ft.dpdns.org,opjmh1nh.dpdns.org,...` 这种格式。</p>
        <el-checkbox v-model="pasteDeleteCf">同时删除 Cloudflare 托管</el-checkbox>
      </el-form>
      <template #footer>
        <el-button @click="pasteDeleteDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="loading || pasteDeleting" @click="submitPasteDelete">开始删除</el-button>
      </template>
    </el-dialog>
  </el-config-provider>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, Cloud, LayoutDashboard, Menu, RefreshCw, SquarePlus } from 'lucide-vue-next';
import { getAuthStatus, loginUser, logoutUser, registerUser } from './api/auth';
import { addCfZone, deleteCfZoneSmart, loadCfConfig, rememberDomainCfAccount } from './api/cloudflare';
import { useCloudflareBatch } from './composables/useCloudflareBatch';
import { useDomainDeleteActions } from './composables/useDomainDeleteActions';
import { useDomainConsole } from './composables/useDomainConsole';
import { usePasteDeleteFlow } from './composables/usePasteDeleteFlow';
import CloudflarePage from './pages/CloudflarePage.vue';
import DomainsPage from './pages/DomainsPage.vue';
import LoginPage from './pages/LoginPage.vue';
import RegisterDomainPage from './pages/RegisterDomainPage.vue';
import { copyText } from './utils/clipboard';
import { formatDomainList } from './utils/domainList';

const activePage = ref('domains');
const authenticated = ref(false);
const authInitialized = ref(false);
const authChecked = ref(false);
const authLoading = ref(true);
const navOpen = ref(false);
const pageTitle = computed(() => {
  const titles = { domains: '域名总览', register: '注册域名', cloudflare: 'Cloudflare' };
  return titles[activePage.value] || '域名总览';
});

const {
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
} = useDomainConsole();

const nsDialogVisible = ref(false);
const apiDialogVisible = ref(false);
const apiKeyInput = ref('');
const nsText = ref('');
const nsTargetText = computed(() => activeDomain.value?.name || '');

const { cfBatching, confirmBatchDeleteCf, confirmBatchHostCf, syncCfAccounts } = useCloudflareBatch({
  loadDomains,
  updateNameserversByName
});
const { confirmBatchDelete, confirmDelete } = useDomainDeleteActions({
  deleteDomainByName,
  deleteDomainsByNames
});
const { openPasteDeleteDialog, pasteDeleteCf, pasteDeleteDialogVisible, pasteDeleteText, pasteDeleting, submitPasteDelete } =
  usePasteDeleteFlow({ deleteDomainsByNames });

function formatNameservers(list) {
  return Array.isArray(list) && list.length ? list.join(', ') : '';
}

function openNsDialog(row) {
  activeDomain.value = row;
  nsText.value = formatNameservers(row.nameservers);
  nsDialogVisible.value = true;
}

function selectPage(page) {
  activePage.value = page;
  navOpen.value = false;
}

function openApiDialog() {
  apiKeyInput.value = apiKey.value;
  apiDialogVisible.value = true;
}

async function submitApiKey() {
  await saveApiKey(apiKeyInput.value);
  apiDialogVisible.value = false;
  ElMessage.success(apiReady.value ? 'API Key 已保存' : 'API Key 已清除');
}

async function loadAuthStatus() {
  authLoading.value = true;
  try {
    const result = await getAuthStatus();
    authInitialized.value = Boolean(result?.data?.initialized);
    authenticated.value = Boolean(result?.data?.authenticated);
  } catch (error) {
    authenticated.value = false;
  } finally {
    authChecked.value = true;
    authLoading.value = false;
  }
}

async function submitAuth(payload) {
  authLoading.value = true;
  try {
    if (payload.register) await registerUser(payload);
    else await loginUser(payload);
    await loadAuthStatus();
    await loadAfterAuth();
    ElMessage.success(payload.register ? '账号已创建' : '登录成功');
  } catch (error) {
    ElMessage.error(error.message || '登录失败');
  } finally {
    authLoading.value = false;
  }
}

async function logout() {
  await logoutUser();
  authenticated.value = false;
  domains.value = [];
  activePage.value = 'domains';
  navOpen.value = false;
}

async function loadAfterAuth() {
  await loadCfConfig();
  await loadApiStatus();
  await loadDomains();
}

async function hostRegisteredDomain(payload) {
  const result = await addCfZone(payload.domain);
  const nameservers = result?.data?.[0]?.name_servers || [];
  if (!nameservers.length) throw new Error('Cloudflare 未返回 NS');
  await rememberDomainCfAccount(payload.domain);
  return nameservers;
}

async function onRegister(payload) {
  if (payload?.batch) {
    await registerDomainsBatch(payload);
  } else {
    await registerNewDomain(payload);
  }
  activePage.value = 'domains';
}

async function submitNs() {
  const nameservers = nsText.value.split(',').map((item) => item.trim()).filter(Boolean);
  if (!nameservers.length) {
    ElMessage.warning('请至少填写一个名称服务器');
    return;
  }
  await updateDomainNameservers(nameservers);
  nsDialogVisible.value = false;
}

async function confirmDeleteCf(row) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.name} 的 Cloudflare 托管吗？`, '删除 CF 托管', {
      cancelButtonText: '取消',
      confirmButtonText: '删除托管',
      type: 'warning'
    });
    await deleteCfZoneSmart(row.name);
    ElMessage.success('Cloudflare 托管已删除');
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除 CF 托管失败');
  }
}

async function copySelectedDomains(rows) {
  const names = formatDomainList(rows);
  if (!names.length) {
    ElMessage.warning('请先选择至少一个域名');
    return;
  }

  try {
    await copyText(names.join(','));
    ElMessage.success(`已复制 ${names.length} 个域名`);
  } catch (error) {
    ElMessage.error(error?.message || '复制失败');
  }
}

onMounted(async () => {
  await loadAuthStatus();
  if (authenticated.value) await loadAfterAuth();
});
</script>
