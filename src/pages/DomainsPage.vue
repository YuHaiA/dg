<template>
  <div class="page-stack">
    <section class="command-strip">
      <div>
        <p class="eyebrow">域名资产</p>
        <h2>DigitalPlat 域名资产</h2>
        <p class="hero-copy">状态、到期日与名称服务器配置集中管理。</p>
      </div>
      <el-button type="primary" :icon="SquarePlus" @click="$emit('register')">注册域名</el-button>
    </section>

    <section class="workspace-panel">
      <div class="toolbar">
        <div>
          <h3>域名列表</h3>
          <p>{{ filteredDomains.length }} / {{ domains.length }} 条数据</p>
        </div>
        <el-space>
          <el-input v-model="keyword" clearable placeholder="搜索域名或后缀" class="search-input" />
          <el-select v-model="cfFilter" class="cf-filter" placeholder="CF 筛选">
            <el-option v-for="item in cfFilterOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-select v-model="statusFilter" class="status-filter" placeholder="状态筛选">
            <el-option v-for="item in statusFilterOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-button :icon="Trash2" type="danger" plain :loading="loading" @click="$emit('paste-delete')">
            粘贴删除
          </el-button>
          <el-button :icon="RefreshCw" :loading="loading" @click="$emit('sync-cf', filteredDomains)">
            同步 CF 状态
          </el-button>
          <el-button :icon="RefreshCw" :loading="loading" @click="$emit('refresh')">刷新</el-button>
        </el-space>
      </div>

      <div v-if="selectedRows.length" class="batch-bar">
        <span>已选 {{ selectedRows.length }} 个域名</span>
        <el-space>
          <el-button plain :loading="loading" @click="$emit('copy-selected', selectedRows)">
            复制域名
          </el-button>
          <el-button :icon="Cloud" type="primary" plain :loading="loading" @click="$emit('batch-host-cf', selectedRows)">
            添加到 CF 并写入 NS
          </el-button>
          <el-button :icon="CloudOff" plain :loading="loading" @click="$emit('batch-delete-cf', selectedRows)">
            删除 CF 托管
          </el-button>
          <el-button :icon="Trash2" type="danger" plain :loading="loading" @click="$emit('batch-delete', selectedRows)">
            批量删除
          </el-button>
        </el-space>
      </div>

      <el-table
        v-loading="loading"
        :data="pagedDomains"
        class="domain-table"
        height="calc(100vh - 306px)"
        size="small"
        stripe
        @sort-change="handleSortChange"
        @selection-change="selectedRows = $event"
      >
        <el-table-column type="selection" />
        <el-table-column label="域名">
          <template #default="{ row }">
            <div class="domain-cell">
              <span class="domain-dot"></span>
              <div>
                <strong>{{ row.name }}</strong>
                <span>{{ row.zone || row.registrar || '-' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="{ row }">
              <el-tag class="status-pill" :type="row.status === 'ok' ? 'success' : 'warning'" effect="light" round>
                {{ row.status }}
              </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="容量类型">
          <template #default="{ row }">
              <el-tag class="slot-pill" effect="plain">{{ row.slot_type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="CF 状态">
          <template #default="{ row }">
            <el-tag :type="cfStatusType(row)" effect="light" round>
              {{ cfStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lifecycle_type" label="生命周期" />
        <el-table-column prop="expiry_date" label="到期日" sortable="custom" />
        <el-table-column label="名称服务器">
          <template #default="{ row }">
            <el-tooltip placement="top" :content="formatNameservers(row.nameservers)">
              <div class="ns-list">
                <el-tag v-for="item in visibleNameservers(row.nameservers)" :key="item" effect="plain" class="ns-tag">
                  {{ item }}
                </el-tag>
                <el-tag v-if="extraNameserverCount(row.nameservers)" effect="plain" class="ns-count">
                  +{{ extraNameserverCount(row.nameservers) }}
                </el-tag>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" header-align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-tooltip content="更新名称服务器" placement="top">
                <el-button :icon="Edit" class="action-button" @click="$emit('update-ns', row)">NS</el-button>
              </el-tooltip>
              <el-tooltip content="删除域名" placement="top">
                <el-button :icon="Trash2" class="action-button danger" @click="$emit('delete-domain', row)" />
              </el-tooltip>
              <el-tooltip content="删除 CF 托管" placement="top">
                <el-button class="action-button" @click="$emit('delete-cf', row)">CF</el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <span>共 {{ filteredDomains.length }} 条</span>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredDomains.length"
          background
          layout="sizes, prev, pager, next"
          small
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Cloud, CloudOff, Edit, RefreshCw, SquarePlus, Trash2 } from 'lucide-vue-next';
import { getDomainCfAccountLabel, hasCloudflareNameservers } from '../api/cloudflare';

const props = defineProps({
  domains: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
});

defineEmits([
  'batch-delete',
  'batch-delete-cf',
  'batch-host-cf',
  'copy-selected',
  'delete-cf',
  'delete-domain',
  'paste-delete',
  'refresh',
  'register',
  'sync-cf',
  'update-ns'
]);

const keyword = ref('');
const cfFilter = ref('all');
const statusFilter = ref('all');
const selectedRows = ref([]);
const currentPage = ref(1);
const pageSize = ref(10);
const sortState = ref({ prop: '', order: '' });

const cfFilterOptions = computed(() => {
  const accounts = [...new Set(props.domains.map((item) => getDomainCfAccountLabel(item.name)).filter(Boolean))];
  return [
    { label: '全部 CF', value: 'all' },
    { label: '未托管', value: 'unconnected' },
    { label: '已托管', value: 'connected' },
    { label: '仅 NS 指向 CF', value: 'ns-only' },
    { label: '已识别账号', value: 'known' },
    ...accounts.map((item) => ({ label: item, value: `account:${item}` }))
  ];
});

const statusFilterOptions = computed(() => {
  const statuses = [...new Set(props.domains.map((item) => item.status || '-'))];
  return [{ label: '全部状态', value: 'all' }, ...statuses.map((item) => ({ label: item, value: item }))];
});

const filteredDomains = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  return props.domains.filter((item) => matchesKeyword(item, value) && matchesCfFilter(item) && matchesStatusFilter(item));
});

const pagedDomains = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedDomains.value.slice(start, start + pageSize.value);
});

const sortedDomains = computed(() => {
  if (sortState.value.prop !== 'expiry_date' || !sortState.value.order) return filteredDomains.value;
  return [...filteredDomains.value].sort(compareExpiryDate);
});

function extraNameserverCount(list) {
  return Array.isArray(list) && list.length > 2 ? list.length - 2 : 0;
}

function formatNameservers(list) {
  return Array.isArray(list) && list.length ? list.join(', ') : '-';
}

function cfStatusText(row) {
  const account = getDomainCfAccountLabel(row.name);
  if (account) return account;
  if (hasCloudflareNameservers(row.nameservers)) return '仅 NS 指向 CF';
  return '未托管';
}

function cfStatusType(row) {
  if (getDomainCfAccountLabel(row.name)) return 'success';
  if (hasCloudflareNameservers(row.nameservers)) return 'warning';
  return 'info';
}

function matchesKeyword(item, value) {
  if (!value) return true;
  return `${item.name} ${item.zone}`.toLowerCase().includes(value);
}

function matchesCfFilter(item) {
  const nsCloudflare = hasCloudflareNameservers(item.nameservers);
  const account = getDomainCfAccountLabel(item.name);
  if (cfFilter.value === 'unconnected') return !account;
  if (cfFilter.value === 'connected') return Boolean(account);
  if (cfFilter.value === 'ns-only') return nsCloudflare && !account;
  if (cfFilter.value === 'known') return Boolean(account);
  if (cfFilter.value.startsWith('account:')) return account === cfFilter.value.replace('account:', '');
  return true;
}

function matchesStatusFilter(item) {
  if (statusFilter.value === 'all') return true;
  return (item.status || '-') === statusFilter.value;
}

function compareExpiryDate(left, right) {
  const direction = sortState.value.order === 'ascending' ? 1 : -1;
  const leftDate = toDateValue(left.expiry_date);
  const rightDate = toDateValue(right.expiry_date);
  if (leftDate.invalid && rightDate.invalid) return 0;
  if (leftDate.invalid) return 1;
  if (rightDate.invalid) return -1;
  return (leftDate.time - rightDate.time) * direction;
}

function handleSortChange({ prop, order }) {
  sortState.value = { prop, order };
  currentPage.value = 1;
}

function toDateValue(value) {
  const text = String(value || '').trim();
  const normalized = text.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  const time = Date.parse(normalized);
  return { invalid: Number.isNaN(time), time };
}

function visibleNameservers(list) {
  return Array.isArray(list) && list.length ? list.slice(0, 2) : ['-'];
}

watch([keyword, cfFilter, statusFilter, pageSize], () => {
  currentPage.value = 1;
});
</script>
