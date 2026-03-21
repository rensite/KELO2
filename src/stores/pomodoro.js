import { defineStore } from 'pinia'

export const usePomodoroStore = defineStore('pomodoro', {
  state: () => ({
    activeTaskId: null,
    isRunning: false,
    isBreak: false,
    timeLeft: 25 * 60, // in seconds
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
    longBreakDuration: 15 * 60,
    sessionsCompleted: 0,
    longBreakInterval: 4,
    totalFocusTimeToday: 0,
    sessions: [], // { taskId, startedAt, duration, type: 'work'|'break' }
    _intervalId: null,
  }),

  getters: {
    formattedTime(state) {
      const m = Math.floor(state.timeLeft / 60)
      const s = state.timeLeft % 60
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    },

    progress(state) {
      const total = state.isBreak
        ? (state.sessionsCompleted % state.longBreakInterval === 0
          ? state.longBreakDuration : state.breakDuration)
        : state.workDuration
      return 1 - (state.timeLeft / total)
    },

    todaySessions(state) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return state.sessions.filter(s => new Date(s.startedAt) >= today && s.type === 'work')
    },

    todayFocusMinutes(state) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return Math.round(
        state.sessions
          .filter(s => new Date(s.startedAt) >= today && s.type === 'work')
          .reduce((sum, s) => sum + s.duration, 0) / 60
      )
    },
  },

  actions: {
    startTimer(taskId) {
      this.activeTaskId = taskId || this.activeTaskId
      this.isRunning = true

      if (this._intervalId) clearInterval(this._intervalId)
      this._intervalId = setInterval(() => {
        if (this.timeLeft > 0) {
          this.timeLeft--
          if (!this.isBreak) {
            this.totalFocusTimeToday++
          }
        } else {
          this.onTimerComplete()
        }
      }, 1000)
    },

    pauseTimer() {
      this.isRunning = false
      if (this._intervalId) {
        clearInterval(this._intervalId)
        this._intervalId = null
      }
    },

    resetTimer() {
      this.pauseTimer()
      this.timeLeft = this.isBreak ? this.breakDuration : this.workDuration
    },

    stopTimer() {
      this.pauseTimer()
      this.isBreak = false
      this.timeLeft = this.workDuration
      this.activeTaskId = null
    },

    onTimerComplete() {
      this.pauseTimer()

      // Play audio
      this.playNotification()

      if (!this.isBreak) {
        // Work session completed
        this.sessionsCompleted++
        this.sessions.push({
          taskId: this.activeTaskId,
          startedAt: new Date(Date.now() - this.workDuration * 1000).toISOString(),
          duration: this.workDuration,
          type: 'work',
        })

        // Start break
        this.isBreak = true
        this.timeLeft = this.sessionsCompleted % this.longBreakInterval === 0
          ? this.longBreakDuration
          : this.breakDuration
      } else {
        // Break completed
        this.sessions.push({
          taskId: this.activeTaskId,
          startedAt: new Date(Date.now() - this.breakDuration * 1000).toISOString(),
          duration: this.breakDuration,
          type: 'break',
        })

        this.isBreak = false
        this.timeLeft = this.workDuration
      }
    },

    playNotification() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 800
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.5)
      } catch (e) {
        // Silent fail for audio
      }
    },

    setWorkDuration(minutes) {
      this.workDuration = minutes * 60
      if (!this.isBreak && !this.isRunning) {
        this.timeLeft = this.workDuration
      }
    },

    setBreakDuration(minutes) {
      this.breakDuration = minutes * 60
    },
  },
})
