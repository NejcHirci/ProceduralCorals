import './style.scss'
import { Engine } from './engine/Engine'
import { GeneratorScene } from './my-generator/GeneratorScene'

new Engine({
  canvas: document.querySelector('#canvas') as HTMLCanvasElement,
  experience: GeneratorScene,
  info: {
    github: 'https://github.com/NejcHirci/ProceduralCorals',
    description: 'A modified space colonization algorithm for generating coral-like structures.',
    documentTitle: 'Procedural Corals',
    title: 'Procedural Corals',
  },
})