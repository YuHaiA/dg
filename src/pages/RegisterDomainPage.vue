<template>
  <div class="register-page">
    <section class="register-hero">
      <p class="eyebrow">新域名注册</p>
      <h2>注册域名</h2>
      <p>单个注册可填前缀，批量注册只填数量，系统自动生成 5-8 位前缀。</p>
    </section>

    <section class="register-layout">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="register-form" @submit.prevent>
        <div class="form-section">
          <el-form-item label="注册模式">
            <el-segmented v-model="form.mode" :options="modeOptions" />
          </el-form-item>

          <el-form-item v-if="form.mode === 'single'" label="域名前缀" prop="domainPrefix">
            <el-input v-model="form.domainPrefix" clearable placeholder="example">
              <template #append>
                <el-select v-model="form.suffix" class="suffix-select" placeholder="选择后缀">
                  <el-option v-for="item in freeDomainSuffixes" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </template>
            </el-input>
            <p class="domain-preview">将注册 <strong>{{ fullDomain }}</strong></p>
          </el-form-item>

          <el-form-item v-else label="注册数量" prop="batchCount">
            <el-input-number v-model="form.batchCount" :min="1" :max="50" controls-position="right" />
            <p class="domain-preview">失败会换新前缀继续，直到注册满 {{ form.batchCount }} 个</p>
          </el-form-item>

          <el-form-item v-if="form.mode === 'batch'" label="免费后缀">
            <el-select v-model="form.suffix" class="suffix-select wide" placeholder="选择后缀">
              <el-option v-for="item in freeDomainSuffixes" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>

          <el-form-item label="容量类型" prop="slot_type">
            <el-radio-group v-model="form.slot_type" class="slot-grid">
              <el-radio-button v-for="item in slotOptions" :key="item.value" :label="item.value">
                {{ item.label }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="名称服务器" prop="nameserversText">
            <el-input
              v-model="form.nameserversText"
              type="textarea"
              :rows="3"
              placeholder="ns1.provider.com, ns2.provider.com"
            />
            <el-button class="cf-host-button" :loading="cfHosting" @click="hostOnCloudflare">
              托管 CF 并填入 NS
            </el-button>
          </el-form-item>
        </div>

        <div class="form-actions">
          <el-button @click="$emit('cancel')">取消</el-button>
          <el-button type="primary" :loading="saving" :disabled="!apiReady" @click="submit">
            {{ form.mode === 'batch' ? '批量注册' : '提交注册' }}
          </el-button>
        </div>
      </el-form>

      <aside class="guide-panel">
        <h3>提交前检查</h3>
        <ul class="check-list">
          <li><span>后缀</span>默认使用 `.dpdns.org`，批量模式只填数量。</li>
          <li><span>容量</span>免费后缀默认使用 `free` 容量。</li>
          <li><span>NS</span>名称服务器用逗号分隔，提交前会去除空白。</li>
          <li><span>批量</span>前缀为 5-8 位数字和小写字母。</li>
          <li><span>安全</span>API Key 只存在本地环境配置。</li>
        </ul>
      </aside>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { freeDomainSuffixes } from '../config/domainSuffixes';

const props = defineProps({
  apiReady: { type: Boolean, default: false },
  cfHostDomain: { type: Function, default: null },
  saving: { type: Boolean, default: false }
});

const emit = defineEmits(['cancel', 'submit']);
const cfHosting = ref(false);
const formRef = ref();
const slotOptions = [
  { label: 'Free', value: 'free' },
  { label: 'Paid', value: 'paid' },
  { label: 'Subscription', value: 'subscription' }
];
const modeOptions = [
  { label: '单个注册', value: 'single' },
  { label: '批量注册', value: 'batch' }
];

const form = reactive({
  mode: 'single',
  domainPrefix: '',
  batchCount: 5,
  suffix: 'dpdns.org',
  slot_type: 'free',
  nameserversText: 'ns1.provider.com, ns2.provider.com'
});

const rules = {
  domainPrefix: [{ validator: validatePrefix, trigger: 'blur' }],
  batchCount: [{ required: true, message: '请输入注册数量', trigger: 'change' }],
  slot_type: [{ required: true, message: '请选择容量类型', trigger: 'change' }],
  nameserversText: [{ required: true, message: '请输入名称服务器', trigger: 'blur' }]
};

const fullDomain = computed(() => {
  const prefix = form.domainPrefix.trim().replace(/^\.+|\.+$/g, '');
  return prefix ? `${prefix}.${form.suffix}` : `example.${form.suffix}`;
});

function parseNameservers(text) {
  return text.split(',').map((item) => item.trim()).filter(Boolean);
}

function validatePrefix(rule, value, callback) {
  if (form.mode === 'batch' || value.trim()) callback();
  else callback(new Error('请输入域名前缀'));
}

async function hostOnCloudflare() {
  if (form.mode !== 'single') {
    ElMessage.warning('批量注册请先完成注册后再逐个托管 CF');
    return;
  }
  if (!form.domainPrefix.trim()) {
    ElMessage.warning('请先填写域名前缀');
    return;
  }
  cfHosting.value = true;
  try {
    if (!props.cfHostDomain) throw new Error('Cloudflare 托管功能未启用');
    const nameservers = await props.cfHostDomain({ domain: fullDomain.value });
    form.nameserversText = nameservers.join(', ');
    ElMessage.success('已获取 Cloudflare NS');
  } finally {
    cfHosting.value = false;
  }
}

async function submit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  const nameservers = parseNameservers(form.nameserversText);
  if (!nameservers.length) {
    ElMessage.warning('请至少填写一个名称服务器');
    return;
  }
  if (form.mode === 'batch') {
    emit('submit', {
      batch: true,
      count: form.batchCount,
      suffix: form.suffix,
      slot_type: form.slot_type,
      nameservers
    });
    return;
  }
  emit('submit', {
    domain: fullDomain.value,
    slot_type: form.slot_type,
    nameservers
  });
}
</script>
