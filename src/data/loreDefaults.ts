import { createId } from '../utils/id';
import type { ArticlesMap } from '../types/lore';

export const buildDefaultArticles = (): ArticlesMap => ({
  characters: [
    {
      id: createId('art'),
      title: 'Ариэлла Львиное Сердце',
      summary: 'Командир воздушной эскадры и харизматичный лидер сопротивления.',
      tags: ['лидер', 'пилот', 'герой'],
      coverColor: '#7d9bff',
      icon: 'fa-solid fa-user-astronaut',
      content:
        '<p><strong>Ариэлла</strong> выросла на летающих островах и с юности поклялась защищать небо. Она сочетает дисциплину академии с безрассудной смелостью.</p><ul><li>Идеал: свобода как высшая ценность.</li><li>Слабость: готова рисковать собой ради команды.</li></ul>',
      updatedAt: Date.now(),
    },
  ],
  races: [
    {
      id: createId('art'),
      title: 'Киннары Люмиса',
      summary: 'Полулюди-полуптицы, чьи голоса направляют магические потоки.',
      tags: ['эфир', 'музыка'],
      coverColor: '#9ce2d8',
      icon: 'fa-solid fa-dna',
      content:
        '<p>Киннары славятся хоровыми ритуалами. От рождения они слышат резонанс мира и используют его в быту и войне.</p><p><em>Черта:</em> могут усиливать любое заклинание звуковой гармонией.</p>',
      updatedAt: Date.now(),
    },
  ],
  worlds: [
    {
      id: createId('art'),
      title: 'Аркология «Сириус»',
      summary: 'Вертикальный город на краю пустоши, питающийся энергией бури.',
      tags: ['город', 'технологии'],
      coverColor: '#f1b26b',
      icon: 'fa-solid fa-globe',
      content:
        '<p>Гигантские турбины собирают плазменные штормы, а элиты живут на верхних уровнях. Нижние ярусы тонут в неоне и парах алхимии.</p>',
      updatedAt: Date.now(),
    },
  ],
  creatures: [
    {
      id: createId('art'),
      title: 'Шёпот Тумана',
      summary: 'Полупрозрачный хищник, охотящийся на эмоции.',
      tags: ['угроза', 'мистика'],
      coverColor: '#c28dff',
      icon: 'fa-solid fa-dragon',
      category: '??????? ????????',
      skillProficiencies: [],
      content:
        '<p>Шёпот появляется там, где люди подавляют страх. Он материализуется в дым и заставляет жертву переживать худшие воспоминания.</p>',
      updatedAt: Date.now(),
    },
  ],
});
