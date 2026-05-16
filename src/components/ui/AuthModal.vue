<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { X, Mail, Loader2, CheckCircle2 } from 'lucide-vue-next'

const auth = useAuthStore()
const email = ref('')

async function submit() {
  const v = email.value.trim()
  if (!v) return
  await auth.sendMagicLink(v)
}

function close() { auth.closeAuthModal() }
</script>

<template>
  <div class="auth-modal-backdrop" @click.self="close">
    <div class="auth-modal">
      <button class="auth-close" @click="close" aria-label="Close">
        <X :size="18" />
      </button>

      <div v-if="!auth.magicLinkSentTo" class="auth-body">
        <h2 class="auth-title">Войти в Kelo</h2>
        <p class="auth-sub">
          Введи email — пришлём magic link. Без пароля.
        </p>

        <form @submit.prevent="submit" class="auth-form">
          <div class="auth-field">
            <Mail :size="16" class="auth-field-icon" />
            <input
              v-model="email"
              type="email"
              required
              placeholder="you@example.com"
              autofocus
              :disabled="auth.loading"
            />
          </div>

          <button type="submit" class="auth-submit" :disabled="auth.loading">
            <Loader2 v-if="auth.loading" :size="16" class="spin" />
            <span>{{ auth.loading ? 'Отправляем…' : 'Отправить ссылку' }}</span>
          </button>

          <p v-if="auth.lastError" class="auth-error">{{ auth.lastError }}</p>
        </form>

        <p class="auth-note">
          После входа локальные данные предложим синхронизировать в облако.
        </p>
      </div>

      <div v-else class="auth-body auth-sent">
        <CheckCircle2 :size="40" class="auth-sent-icon" />
        <h2 class="auth-title">Проверь почту</h2>
        <p class="auth-sub">
          Письмо отправлено на<br><strong>{{ auth.magicLinkSentTo }}</strong>
        </p>
        <button class="auth-submit" @click="close">Понятно</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;

.auth-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: $z-modal;
  padding: $space-4;
}

.auth-modal {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: $color-bg-elevated;
  border-radius: $radius-lg;
  padding: $space-6;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}

.auth-close {
  position: absolute;
  top: $space-3;
  right: $space-3;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: $color-text-muted;
  border-radius: $radius-sm;
  cursor: pointer;
  &:hover { background: $color-bg-hover; color: $color-text-primary; }
}

.auth-title {
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  margin: 0 0 $space-2;
  color: $color-text-primary;
}

.auth-sub {
  margin: 0 0 $space-5;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  line-height: 1.5;
}

.auth-form { display: flex; flex-direction: column; gap: $space-3; }

.auth-field {
  position: relative;
  display: flex;
  align-items: center;

  .auth-field-icon {
    position: absolute;
    left: $space-3;
    color: $color-text-muted;
    pointer-events: none;
  }

  input {
    width: 100%;
    padding: $space-3 $space-3 $space-3 36px;
    border: 1.5px solid $color-border;
    border-radius: $radius-md;
    font-size: $font-size-sm;
    background: $color-bg;
    color: $color-text-primary;
    outline: none;
    transition: border-color $transition-fast;
    &:focus { border-color: $color-primary; }
  }
}

.auth-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  padding: $space-3 $space-4;
  border-radius: $radius-md;
  border: none;
  background: $color-primary;
  color: white;
  font-weight: $font-weight-semibold;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: opacity $transition-fast;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.6; cursor: wait; }
}

.auth-error {
  margin: $space-2 0 0;
  color: $color-error;
  font-size: $font-size-sm;
}

.auth-note {
  margin: $space-4 0 0;
  color: $color-text-muted;
  font-size: $font-size-xs;
  line-height: 1.5;
}

.auth-sent { text-align: center; }
.auth-sent-icon { color: $color-success; margin: 0 auto $space-3; display: block; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
