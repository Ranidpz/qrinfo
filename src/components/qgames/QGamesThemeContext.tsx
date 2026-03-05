'use client';

import { createContext, useContext } from 'react';
import { QGamesTheme, QGAMES_THEMES } from '@/types/qgames';

const QGamesThemeContext = createContext<QGamesTheme>(QGAMES_THEMES['dark-gaming']);

export const QGamesThemeProvider = QGamesThemeContext.Provider;
export const useQGamesTheme = () => useContext(QGamesThemeContext);
