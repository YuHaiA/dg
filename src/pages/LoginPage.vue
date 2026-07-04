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
        <h1>{{ pageTitle }}</h1>
        <p>{{ pageCopy }}</p>
      </div>
    </section>

    <section class="login-panel">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
        <div class="login-panel-head">
          <h2>{{ panelTitle }}</h2>
          <p>登录状态使用本地 Cookie 保存。</p>
        </div>

        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" clearable placeholder="admin" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" show-password clearable placeholder="至少 6 位" />
        </el-form-item>

        <el-button type="primary" class="login-submit" :loading="loading" @click="submit">
          {{ isRegisterMode ? '注册并进入' : '进入控制台' }}
        </el-button>
        <el-button v-if="initialized" class="login-switch" link type="primary" @click="toggleMode">
          {{ isRegisterMode ? '已有账号，去登录' : '没有账号，注册一个' }}
        </el-button>
      </el-form>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps({
  initialized: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['submit']);
const formRef = ref();
const mode = ref('login');
const form = reactive({ username: '', password: '' });

const isRegisterMode = computed(() => !props.initialized || mode.value === 'register');
const pageTitle = computed(() => (isRegisterMode.value ? '注册控制台账号' : '登录控制台'));
const pageCopy = computed(() =>
  isRegisterMode.value ? '注册后会拥有独立保存的 API 与 Cloudflare 配置。' : '登录后读取当前账号保存的 API 与 Cloudflare 配置。'
);
const panelTitle = computed(() => (isRegisterMode.value ? '账号注册' : '账号登录'));

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ]
};

async function submit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  emit('submit', {
    register: isRegisterMode.value,
    username: form.username.trim(),
    password: form.password
  });
}

function toggleMode() {
  mode.value = isRegisterMode.value ? 'login' : 'register';
}

watch(
  () => props.initialized,
  (initialized) => {
    mode.value = initialized ? 'login' : 'register';
  },
  { immediate: true }
);
</script>
