import { guildhallPageThemes } from './pageThemes';

describe('guildhallPageThemes', () => {
  it('defines the guild, practice and aspect page themes', () => {
    expect(Object.keys(guildhallPageThemes).sort()).toEqual(['aspect', 'guild', 'practice']);
  });

  it.each(['guild', 'practice', 'aspect'] as const)(
    '%s is a renderable PageTheme with a gradient and white text',
    key => {
      const pt = guildhallPageThemes[key];
      expect(pt.backgroundImage).toContain('linear-gradient');
      expect(pt.fontColor.toUpperCase()).toBe('#FFFFFF');
    },
  );
});
