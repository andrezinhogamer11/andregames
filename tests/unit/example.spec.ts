import { mount } from '@vue/test-utils'
import HomePage from '@/views/HomePage.vue'
import { describe, expect, test } from 'vitest'

describe('HomePage.vue', () => {
  test('renders the BURRO game home screen', () => {
    const wrapper = mount(HomePage)
    expect(wrapper.text()).toContain('BURRO')
    expect(wrapper.text()).toContain('Abrir uma mesa')
    expect(wrapper.text()).toContain('Bluetooth')
  })
})
