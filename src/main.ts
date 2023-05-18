import './style.scss'
import { Engine } from './engine/Engine'
import { Experience } from './engine/Experience'

new Engine({
  canvas: document.querySelector('#canvas') as HTMLCanvasElement,
  experience: class implements Experience {
    resources = []
    init() {}
    update() {}
    resize() {}
  }
})