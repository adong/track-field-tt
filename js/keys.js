/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.TF_TITLE || 'TT Track & Field',
  cols: ['1 player', 'Player 1', 'Player 2'],
  keys: [
    ['run: tap left, right, left, right', '← →', 'A D', '← →'],
    ['jump or throw (NORMAL: hold, let go at the gold)', 'Space', 'W', '↑'],
    ['call your brother (2 players: high five)', 'T', 'T', 'T'],
    ['pick your athlete (title)', '← →', 'A D', '← →'],
    ['easy or normal (title)', 'E', '', ''],
    ['start · next', 'Enter', 'Enter', 'Enter'],
    ['pause', 'P or Esc', 'P or Esc', 'P or Esc'],
    ['sound on / off', 'M', 'M', 'M'],
  ],
  note: 'EASY: any foot key counts, and you jump or throw at the line by yourself. NORMAL: left, right, left, right (the same foot twice is a weak step), and over the line is a foul.',
  touch: 'Tap the two feet fast to run, then tap JUMP or THROW. Tap your brother\'s face to call him.',
});
