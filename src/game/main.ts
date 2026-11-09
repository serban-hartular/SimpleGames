import { loadLanguage } from './i18n';
import { loadSettings } from './settings/store';
import { FoxGame } from './scenes/FoxGame';
import { RobotGame } from './scenes/RobotGame';
import { StreetsGame } from './scenes/StreetsGame';
import { NavigationGame } from './scenes/NavigationGame';
import { SnakeGame } from './scenes/SnakeGame';
import { DivisibilityGame } from './scenes/DivisibilityGame';
import { MainMenu } from './scenes/MainMenu';
import { ArtilleryGame } from './scenes/ArtilleryGame';
import { AUTO, Game, Scale,Types } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        MainMenu,
        ArtilleryGame,
        DivisibilityGame,
        SnakeGame,
        NavigationGame,
        FoxGame,
        StreetsGame,
        RobotGame
    ]
};

const StartGame = (parent: string) => {
    loadLanguage();
    loadSettings();
    return new Game({ ...config, parent });
}

export default StartGame;
