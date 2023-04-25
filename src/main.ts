import './style.scss'
import { Engine } from './engine/Engine'
import { GeneratorScene } from './my-generator/GeneratorScene'

new Engine({
  canvas: document.querySelector('#canvas') as HTMLCanvasElement,
  experience: GeneratorScene
})