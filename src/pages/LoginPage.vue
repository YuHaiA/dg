<template>
  <main class="login-page">
    <section class="login-visual">
      <div class="login-brand">
        <div class="brand-mark">DP</div>
        <div>
          <strong>DigitalPlat</strong>
          <span>域名运营台</span>
        </div>
      </div>
      <div class="login-copy">
        <p class="eyebrow">Console Access</p>
        <h1>登录控制台</h1>
        <p>填写 DigitalPlat API Key 后进入域名管理、批量注册与 CF 托管工作台。</p>
      </div>
    </section>

    <section class="login-panel">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
        <div class="login-panel-head">
          <h2>API 登录</h2>
          <p>Key 只保存在当前浏览器本地。</p>
        </div>

        <el-form-item label="DigitalPlat API Key" prop="apiKey">
          <el-input v-model="form.apiKey" show-password clearable placeholder="dp_live_..." />
        </el-form-item>

        <el-button type="primary" class="login-submit" :loading="loading" @click="submit">进入控制台</el-button>
      </el-form>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue';

defineProps({
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['submit']);
const formRef = ref();
const form = reactive({ apiKey: '' });

const rules = {
  apiKey: [
    { required: true, message: '请输入 API Key', trigger: 'blur' },
    { validator: validateApiKey, trigger: 'blur' }
  ]
};

function validateApiKey(rule, value, callback) {
  const text = value.trim();
  if (text.startsWith('dp_live_') || text.startsWith('dp_test_')) callback();
  else callback(new Error('API Key 应以 dp_live_ 或 dp_test_ 开头'));
}

async function submit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  emit('submit', form.apiKey.trim());
}
</script>
