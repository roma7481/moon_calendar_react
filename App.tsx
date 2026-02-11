import React, { useEffect, useMemo, useRef, useState } from 'react';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Image,
  Platform,
  useWindowDimensions,
  Dimensions,
  View,
  Linking,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Localization from 'expo-localization';
import { MaterialIcons } from '@expo/vector-icons';
import * as suncalc from 'suncalc';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment-timezone';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';

import { calcMoonDays, calcMoonMonth, LunarDay } from './src/domain/moon/lunar';
import { calcMoonInfo } from './src/domain/moon/moonInfo';
import { calcMoonZodiac } from './src/domain/zodiac/zodiac';
import { AppLocale, City, getAllCities, getMoonDayInfo, getZodiacInfo } from './src/data/content';
import { NoteRecord } from './src/notes/notesRepository';
import { useNotes } from './src/notes/useNotes';
import {
  getStoredCity,
  getStoredCustomCities,
  getStoredLanguage,
  getStoredNotifications,
  getStoredPremium,
  getStoredTextSize,
  getStoredTheme,
  setStoredCity,
  setStoredCustomCities,
  setStoredLanguage,
  setStoredNotifications,
  setStoredPremium,
  setStoredTextSize,
  setStoredTheme,
} from './src/services/storage';
import {
  cancelDailyReminder,
  ensureNotificationPermissions,
  hasNotificationPermission,
  scheduleDailyReminder,
} from './src/services/notifications';
import { initAds, Banner, createInterstitial, AdEventType, nativeUnitId, useAdProvider } from './src/services/adProvider';
import { exportNotes, importNotes } from './src/services/backup';
import NativeAdSlot from './src/ui/NativeAdSlot';
import { resolveLocale } from './src/services/locale';
import { colors, shadows, ThemeName, themes } from './src/ui/theme';
import { recordLaunchAndShouldShow, remindLater, setDoNotShowAgain } from './src/services/rateUs';
import { useOtherApps } from './src/services/useOtherApps';
import { migrateLegacyCities } from './src/services/legacyMigration';
import * as RNIap from 'react-native-iap';
import type { Purchase, PurchaseError } from 'react-native-iap';

type MoonScreenData = {
  cityName: string;
  moonDay: LunarDay;
  moonPhase: string;
  illuminationPct: number;
  daysToFullMoon: number | null;
  moonSign: string;
  moonSignDescription?: string;
  moonRise: Date;
  moonSet: Date;
  categories: CategoryItem[];
};

type CategoryItem = {
  key: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: string;
  linkText?: string;
};

type Strings = ReturnType<typeof getStrings>;

type CalendarDayData = {
  zodiac: string;
  lunarDayNumbers: number[];
  illuminationPct: number;
  isWaxing: boolean;
};

type CustomCityRecord = City & { id: string };

const fallbackCity = { name: 'New York', latitude: 40.714, longitude: -74.006 };
const PREMIUM_PRODUCT_ID = 'moon_premium';

const getStrings = (locale: AppLocale) => {
  const isRu = locale === 'ru';

  return {
    appTitle: isRu ? 'Лунный календарь' : 'Moon Calendar',
    appSubtitle: isRu ? 'Лунный календарь' : 'Moon Calendar App',
    dailyInfluences: isRu ? 'Ежедневные влияния' : 'Daily Influences',
    profileTitle: isRu ? 'Профиль' : 'Profile',
    language: isRu ? 'Язык' : 'Language',
    english: 'English',
    russian: 'Русский',
    notifications: isRu ? 'Уведомления' : 'Notifications',
    dailyReminder: isRu ? 'Ежедневное напоминание' : 'Daily reminder',
    reminderTime: isRu ? 'Время напоминания' : 'Reminder time',
    reminderTitle: isRu ? 'Лунный календарь' : 'Moon Calendar',
    reminderBody: isRu ? 'Ваш лунный прогноз готов.' : 'Your lunar update is ready.',
    reminderError: isRu ? 'Не удалось включить напоминание.' : 'Unable to schedule reminder.',
    textSize: isRu ? 'Размер текста' : 'Text size',
    sizeSmall: isRu ? 'Маленький' : 'Small',
    sizeMedium: isRu ? 'Средний' : 'Medium',
    sizeLarge: isRu ? 'Большой' : 'Large',
    theme: isRu ? 'Тема' : 'Theme',
    themeBlueDay: isRu ? 'Голубой день' : 'Blue Day',
    themeDeepBlueNight: isRu ? 'Глубокая синяя ночь' : 'Deep Blue Night',
    themeRaspberry: isRu ? 'Малина' : 'Raspberry',
    themeDreamland: isRu ? 'Дримленд' : 'Dreamland',
    themeAmethyst: isRu ? 'Аметист' : 'Amethyst',
    moreApps: isRu ? 'Другие приложения' : 'More Apps',
    rateAppTitle: isRu ? 'Лунный календарь' : 'Moon calendar',
    rateEnjoyTitle: isRu ? 'Лунный календарь' : 'Moon calendar',
    rateEnjoyBody: isRu ? 'Вам нравится это приложение?' : 'Do you enjoy the app?',
    rateYes: isRu ? 'Да' : 'Yes',
    rateNo: isRu ? 'Нет' : 'No',
    rateTitle: isRu ? 'Оцените приложение' : 'Rate us',
    rateBody: isRu
      ? 'Если вам понравилось это приложение, пожалуйста, найдите время, чтобы оценить его. Это не займет больше минуты. Спасибо за вашу поддержку!'
      : 'If you like this app, please take a moment to rate it. It will not take more than a minute. Thanks for your support!',
    rateNow: isRu ? 'Ок' : 'Rate now',
    rateLater: isRu ? 'Напомнить позже' : 'Remind me later',
    rateNoThanks: isRu ? 'Нет, спасибо' : 'No thanks',
    healingPhrases: {
      universal: isRu
        ? [
          'Звуки могут мягко поддержать эту лунную энергию.',
          'Звук может деликатно поддержать эту фазу.',
          'Простой звуковой ритуал может быть поддерживающим.',
        ]
        : [
          'Support this lunar energy with sound.',
          'Sound can gently support this phase.',
          'A simple sound ritual may feel supportive.',
        ],
      newMoon: isRu
        ? [
          'Заземляющий звуковой ритуал может поддержать новые начала.',
          'Тихие звуки могут сопровождать постановку намерений.',
        ]
        : [
          'A grounding sound ritual may support new beginnings.',
          'Quiet tones can accompany intention-setting.',
        ],
      waxing: isRu
        ? ['Звук может поддержать фокус и рост.', 'Звуки для ясности могут быть полезны.']
        : ['Support focus and growth with sound.', 'Clarity-focused sounds may feel helpful.'],
      firstQuarter: isRu
        ? ['Заземляющие звуки могут помочь при сопротивлении.', 'Звук может поддержать спокойное действие.']
        : ['Grounding sounds may help with resistance.', 'Sound can support steady action.'],
      fullMoon: isRu
        ? ['Успокаивающие звуки могут поддержать эмоциональное освобождение.', 'Звук может помочь снизить интенсивность.']
        : ['Calming sounds may support emotional release.', 'Sound can help settle intensity.'],
      waning: isRu
        ? ['Мягкие звуки поддерживают отдых и интеграцию.', 'Звук может помочь замедлиться.']
        : ['Soft tones support rest and integration.', 'Sound can help you slow down.'],
      darkMoon: isRu
        ? ['Очень мягкий звук или тишина могут быть наиболее комфортными.', 'В этой фазе слушать необязательно.']
        : ['Very gentle sound or silence may feel safest.', 'Listening is optional during this phase.'],
    },
    notesTitle: isRu ? 'Заметки' : 'Notes',
    notesSubtitle: isRu ? 'Лунный дневник' : 'Moon Journal',
    notePlaceholder: isRu ? 'Добавьте заметку...' : 'Write your note...',
    noteSave: isRu ? 'Сохранить' : 'Save',
    noteDelete: isRu ? 'Удалить' : 'Delete',
    notesEmpty: isRu ? 'Заметок пока нет.' : 'No notes yet.',
    notesListTitle: isRu ? 'Все заметки' : 'All notes',
    noteForDay: (day: number) => (isRu ? `Заметка для лунного дня ${day}` : `Note for lunar day ${day}`),
    noteEdit: isRu ? 'Редактировать' : 'Edit',
    customCityTitle: isRu ? 'Свои координаты' : 'Custom City',
    cityNameLabel: isRu ? 'Название' : 'Name',
    latitudeLabel: isRu ? 'Широта' : 'Latitude',
    longitudeLabel: isRu ? 'Долгота' : 'Longitude',
    saveCustomCity: isRu ? 'Сохранить' : 'Save',
    invalidCustomCity: isRu ? 'Проверьте название и координаты.' : 'Please check the name and coordinates.',
    citySaved: isRu ? 'Город сохранён' : 'City Saved',
    edit: isRu ? 'Редактировать' : 'Edit',
    delete: isRu ? 'Удалить' : 'Delete',
    noCustomCities: isRu ? 'Своих городов пока нет.' : 'No custom cities yet.',
    privacyPolicy: isRu ? 'Политика конфиденциальности' : 'Privacy Policy',
    deleteCityTitle: isRu ? 'Удалить город?' : 'Delete city?',
    deleteCityMessage: isRu ? 'Вы уверены, что хотите удалить этот город?' : 'Are you sure you want to delete this city?',
    cancel: isRu ? 'Отмена' : 'Cancel',
    exportNotes: isRu ? 'Экспорт заметок' : 'Export notes',
    importNotes: isRu ? 'Импорт заметок' : 'Import notes',
    importSuccess: (count: number) => (isRu ? `Импортировано ${count} записей` : `Imported ${count} notes`),
    importFailed: isRu ? 'Не удалось импортировать файл' : 'Import failed',
    premium: isRu ? 'Премиум' : 'Premium',
    premiumTitle: isRu ? 'Премиум доступ' : 'Premium Access',
    premiumSubtitle: isRu ? 'Разблокируйте все функции за один платеж' : 'Unlock all features with a one-time purchase',
    premiumCta: isRu ? 'Разблокировать' : 'Unlock Premium',
    premiumRestore: isRu ? 'Восстановить покупку' : 'Restore Purchase',
    premiumNotNow: isRu ? 'Не сейчас' : 'Not now',
    premiumLocked: isRu ? 'Требуется премиум' : 'Premium required',
    premiumActive: isRu ? 'Активен' : 'Active',
    premiumUnlocked: isRu ? 'Премиум активирован.' : 'Premium activated.',
    purchaseFailed: isRu ? 'Покупка не удалась.' : 'Purchase failed.',
    restoreSuccess: isRu ? 'Покупка восстановлена.' : 'Purchase restored.',
    restoreNone: isRu ? 'Покупки не найдены.' : 'No purchases found.',
    premiumBenefits: isRu
      ? [
        'Доступ к заметкам и лунному дневнику',
        'Все категории дня без ограничений',
        'Просмотр будущих дат в календаре',
        'Без рекламы',
      ]
      : [
        'Moon calendar journal and notes',
        'Unlock all daily categories',
        'View future calendar dates',
        'Remove ads',
      ],
    restorePurchase: isRu ? 'Восстановить покупки' : 'Restore Purchase',
    support: isRu ? 'Поддержка' : 'Support',
    feedback: isRu ? 'Обратная связь' : 'Send Feedback',
    about: isRu ? 'О приложении' : 'About',
    version: isRu ? 'Версия' : 'Version',
    comingSoon: isRu ? 'Скоро' : 'Coming soon',
    city: isRu ? 'Город' : 'City',
    moonSign: isRu ? 'Лунный знак' : 'Moon Sign',
    lunarDay: isRu ? 'Лунный день' : 'Lunar Day',
    starts: isRu ? 'Начало' : 'Starts',
    ends: isRu ? 'Конец' : 'Ends',
    chooseCity: isRu ? 'Выбор города' : 'Choose City',
    searchCities: isRu ? 'Поиск города' : 'Search cities',
    noCities: isRu ? 'Города не найдены.' : 'No cities match your search.',
    illumination: isRu ? 'освещенности' : 'Illumination',
    daysToFullMoon: (days: number) => (isRu ? `До полнолуния ${days} дн.` : `${days} Days to Full Moon`),
    fullMoon: isRu ? 'Полнолуние' : 'Full Moon',
    weekdays: isRu ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    weekStartsOnMonday: isRu,
    noCategoryData: isRu ? 'Нет данных для выбранного лунного дня.' : 'No category data for this lunar day.',
    influenceTitles: {
      dayCharacteristics: isRu ? 'Характеристика дня' : 'Day Characteristics',
      personality: isRu ? 'Влияние на личность' : 'Personality',
      business: isRu ? 'Бизнес и карьера' : 'Business & Career',
      health: isRu ? 'Здоровье' : 'Health & Wellness',
      haircut: isRu ? 'Стрижка и рост' : 'Haircut & Growth',
      relations: isRu ? 'Отношения' : 'Relationships',
      marriage: isRu ? 'Брак' : 'Marriage',
      birthday: isRu ? 'День рождения' : 'Birthday',
      recommendations: isRu ? 'Рекомендации' : 'Recommendations',
      warnings: isRu ? 'Предупреждения' : 'Warnings',
      dreams: isRu ? 'Сны' : 'Dreams',
      manicure: isRu ? 'Маникюр' : 'Manicure',
      diet: isRu ? 'Диета' : 'Diet',
      shopping: isRu ? 'Шоппинг' : 'Shopping',
      garden: isRu ? 'Садоводство' : 'Gardening',
    },
    phaseLabels: {
      'New Moon': isRu ? 'Новолуние' : 'New Moon',
      'Waxing Crescent': isRu ? 'Растущий серп' : 'Waxing Crescent',
      'Waxing Gibbous': isRu ? 'Растущая луна' : 'Waxing Gibbous',
      'Full Moon': isRu ? 'Полнолуние' : 'Full Moon',
      'Waning Gibbous': isRu ? 'Убывающая луна' : 'Waning Gibbous',
      'Waning Crescent': isRu ? 'Убывающий серп' : 'Waning Crescent',
    },
  };
};

const makeCategory = (
  key: string,
  title: string,
  description: string | undefined,
  icon: keyof typeof MaterialIcons.glyphMap,
  accent: string
): CategoryItem | null => {
  if (!description || description.trim().length === 0) return null;
  return { key, title, description: description.trim(), icon, accent };
};

const buildCategories = (
  info: {
    dayCharacteristics?: string;
    personality?: string;
    business?: string;
    health?: string;
    haircut?: string;
    relations?: string;
    marriage?: string;
    birthday?: string;
    recommendations?: string;
    warnings?: string;
    dreams?: string;
    manicure?: string;
    diet?: string;
    shopping?: string;
    garden?: string;
  },
  strings: Strings,
  links?: Record<string, string | undefined>
): CategoryItem[] => {
  const ordered = [
    makeCategory('day-characteristics', strings.influenceTitles.dayCharacteristics, info.dayCharacteristics, 'auto-awesome', '#FFD37E'),
    makeCategory('personality', strings.influenceTitles.personality, info.personality, 'psychology', '#9AD0FF'),
    makeCategory('business', strings.influenceTitles.business, info.business, 'business-center', '#80A7FF'),
    makeCategory('health', strings.influenceTitles.health, info.health, 'healing', '#FF93A7'),
    makeCategory('haircut', strings.influenceTitles.haircut, info.haircut, 'content-cut', '#C89BFF'),
    makeCategory('relations', strings.influenceTitles.relations, info.relations, 'favorite', '#FF8BC9'),
    makeCategory('marriage', strings.influenceTitles.marriage, info.marriage, 'favorite-border', '#FFA1B9'),
    makeCategory('birthday', strings.influenceTitles.birthday, info.birthday, 'celebration', '#FFBE6F'),
    makeCategory('recommendations', strings.influenceTitles.recommendations, info.recommendations, 'lightbulb', '#FFE38D'),
    makeCategory('warnings', strings.influenceTitles.warnings, info.warnings, 'warning', '#FF7E7E'),
    makeCategory('dreams', strings.influenceTitles.dreams, info.dreams, 'bedtime', '#9FA8FF'),
    makeCategory('manicure', strings.influenceTitles.manicure, info.manicure, 'spa', '#8CF0C1'),
    makeCategory('diet', strings.influenceTitles.diet, info.diet, 'restaurant', '#FFD27D'),
    makeCategory('shopping', strings.influenceTitles.shopping, info.shopping, 'shopping-cart', '#8EE6FF'),
    makeCategory('garden', strings.influenceTitles.garden, info.garden, 'eco', '#7CE6B6'),
  ];

  return ordered
    .filter((item): item is CategoryItem => item !== null)
    .map((item) => ({ ...item, linkText: links?.[item.key] }));
};

const pickHealingPhrase = (phaseName: string, strings: Strings, seed: number) => {
  const phase = phaseName.toLowerCase();
  let list: string[] = [];
  if (phase.includes('new')) list = strings.healingPhrases.newMoon;
  else if (phase.includes('full')) list = strings.healingPhrases.fullMoon;
  else if (phase.includes('waxing')) list = strings.healingPhrases.waxing;
  else if (phase.includes('waning')) list = strings.healingPhrases.waning;
  else list = strings.healingPhrases.universal;
  const combined = [...strings.healingPhrases.universal, ...list];
  const index = Math.abs(seed) % combined.length;
  return combined[index];
};

const shouldShowHealingLink = (date: Date, moonDay: number, key: string) => {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate() + moonDay + key.length;
  return seed % 3 === 0;
};

const sortMoonDays = (days: LunarDay[]) => [...days].sort((a, b) => a.start - b.start);

const isSameMoonDay = (a: LunarDay | null, b: LunarDay | null) =>
  !!a && !!b && a.number === b.number && a.start === b.start && a.end === b.end;

const isSameDayInTz = (a: Date, b: Date, tz: string) =>
  moment(a).tz(tz).format('YYYY-MM-DD') === moment(b).tz(tz).format('YYYY-MM-DD');

const pickActiveMoonDay = (days: LunarDay[], nowMs: number) =>
  days.find((day) => nowMs >= day.start && nowMs < day.end) ?? days[0] ?? null;

const resolveMoonData = async (
  date: Date,
  selectedCity: City,
  locale: AppLocale,
  strings: Strings,
  timezone: string,
  moonDay: LunarDay,
  moonDays: LunarDay[]
): Promise<MoonScreenData> => {
  const city = selectedCity ?? fallbackCity;
  const moonInfo = calcMoonInfo(moonDay);

  const zodiac = calcMoonZodiac(moonDays, moonDay.number);
  const zodiacInfo = await getZodiacInfo(zodiac, locale);

  const dayInfo = await getMoonDayInfo(moonDay.number, locale, zodiac);
  const links: Record<string, string | undefined> = {};
  const seedDate = new Date(moonDay.start);
  if (shouldShowHealingLink(seedDate, moonDay.number, 'day-characteristics')) {
    links['day-characteristics'] = pickHealingPhrase(moonInfo.phaseName, strings, moonDay.number);
  }
  if (shouldShowHealingLink(seedDate, moonDay.number, 'health')) {
    links['health'] = pickHealingPhrase(moonInfo.phaseName, strings, moonDay.number + 7);
  }

  return {
    cityName: city.name,
    moonDay,
    moonPhase: moonInfo.phaseName,
    illuminationPct: moonInfo.illuminationPct,
    daysToFullMoon: moonInfo.daysToFullMoon,
    moonSign: zodiacInfo?.name ?? zodiac.charAt(0).toUpperCase() + zodiac.slice(1),
    moonSignDescription: zodiacInfo?.info,
    moonRise: moonInfo.riseTime,
    moonSet: moonInfo.setTime,
    categories: buildCategories(dayInfo ?? {}, strings, links),
  };
};

function AppContent() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [city, setCity] = useState<City | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [cityQuery, setCityQuery] = useState('');
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [cityLoading, setCityLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moonData, setMoonData] = useState<MoonScreenData | null>(null);
  const [moonDayOptions, setMoonDayOptions] = useState<LunarDay[]>([]);
  const [selectedMoonDay, setSelectedMoonDay] = useState<LunarDay | null>(null);
  const [isManualMoonDaySelection, setIsManualMoonDaySelection] = useState(false);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    'moon-sign': true,
    'day-characteristics': true,
  });
  const [locale, setLocale] = useState<AppLocale>(() => resolveLocale());
  const [activeTab, setActiveTab] = useState<'home' | 'calendar' | 'notes' | 'profile'>('home');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationMinutes, setNotificationMinutes] = useState(9 * 60);
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarData, setCalendarData] = useState<Record<number, CalendarDayData>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [iapReady, setIapReady] = useState(false);
  const [iapBusy, setIapBusy] = useState(false);
  const purchaseListenerRef = useRef<ReturnType<typeof RNIap.purchaseUpdatedListener> | null>(null);
  const purchaseErrorRef = useRef<ReturnType<typeof RNIap.purchaseErrorListener> | null>(null);
  const [themeName, setThemeName] = useState<ThemeName>('blue-day');
  const interstitialRef = useRef<ReturnType<typeof createInterstitial> | null>(null);
  const tabSwitchCount = useRef(0);
  const [noteTargetDayId, setNoteTargetDayId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [currentNote, setCurrentNote] = useState<NoteRecord | null>(null);
  const [notesBusy, setNotesBusy] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customCityName, setCustomCityName] = useState('');
  const [customLatitude, setCustomLatitude] = useState('');
  const [customLongitude, setCustomLongitude] = useState('');
  const [customCities, setCustomCities] = useState<CustomCityRecord[]>([]);
  const [editingCustomCityId, setEditingCustomCityId] = useState<string | null>(null);
  const [baseCities, setBaseCities] = useState<City[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarType, setSnackbarType] = useState<'info' | 'error'>('info');
  const snackbarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rateDialogShown = useRef(false);
  const [rateStep, setRateStep] = useState<'none' | 'enjoy' | 'rate'>('none');
  const [adsReady, setAdsReady] = useState(false);

  const { notes, loading: notesLoading, error: notesError, getNoteForMoonDay, saveNote, removeNote, refreshNotes, getAllNotes } =
    useNotes();
  const { apps: otherApps, loading: otherAppsLoading } = useOtherApps(locale);
  const adProvider = useAdProvider();

  const strings = useMemo(() => getStrings(locale), [locale]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const bannerWidth = Math.floor(Dimensions.get('screen').width || windowWidth);
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || Localization.timezone || 'UTC',
    []
  );
  const deviceLocale = useMemo(() => {
    const detected = Localization.locale || Intl.DateTimeFormat().resolvedOptions().locale;
    if (detected) return detected;
    return locale === 'ru' ? 'ru-RU' : 'en-US';
  }, [locale]);
  const theme = useMemo(() => themes[themeName], [themeName]);
  const showAds = !isPremium;

  const textScale = useMemo(() => {
    if (textSize === 'small') return 0.9;
    if (textSize === 'large') return 1;
    return 0.95;
  }, [textSize]);
  const styles = useMemo(() => createStyles(textScale, theme), [textScale, theme]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(deviceLocale, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone,
      }),
    [deviceLocale, timezone]
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(deviceLocale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }),
    [deviceLocale, timezone]
  );
  const lunarRangeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(deviceLocale, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }),
    [deviceLocale, timezone]
  );
  const lunarDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(deviceLocale, {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
      }),
    [deviceLocale, timezone]
  );
  const lunarTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(deviceLocale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }),
    [deviceLocale, timezone]
  );
  const formatLunarShort = (value: number) =>
    `${lunarDateFormatter.format(new Date(value))} ${lunarTimeFormatter.format(new Date(value))}`;
  const formatLunarStart = (day: LunarDay) => `${strings.starts} ${formatLunarShort(day.start)}`;
  const formatLunarEnd = (day: LunarDay) => `${strings.ends} ${formatLunarShort(day.end)}`;
  const reminderDate = useMemo(() => {
    const base = new Date();
    base.setHours(Math.floor(notificationMinutes / 60), notificationMinutes % 60, 0, 0);
    return base;
  }, [notificationMinutes]);

  const mergeCities = (customList: CustomCityRecord[], cityList: City[]) => {
    const customCitiesOnly = customList.map(({ id, ...city }) => city);
    const filtered = cityList.filter(
      (item) =>
        !customCitiesOnly.some(
          (custom) =>
            Math.abs(custom.latitude - item.latitude) < 0.001 &&
            Math.abs(custom.longitude - item.longitude) < 0.001
        )
    );
    return [...customCitiesOnly, ...filtered];
  };

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      const [storedLanguage, storedNotifications, storedTextSize, storedPremium, storedTheme] = await Promise.all([
        getStoredLanguage(),
        getStoredNotifications(),
        getStoredTextSize(),
        getStoredPremium(),
        getStoredTheme(),
      ]);
      if (!active) return;
      if (storedLanguage) setLocale(storedLanguage);
      setNotificationsEnabled(storedNotifications.enabled);
      setNotificationMinutes(storedNotifications.minutes);
      if (storedTextSize) setTextSize(storedTextSize);
      setIsPremium(storedPremium);
      if (storedTheme) setThemeName(storedTheme);
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notificationsEnabled) return;
    hasNotificationPermission()
      .then((granted) => {
        if (!granted) {
          setNotificationsEnabled(false);
          return setStoredNotifications(false, notificationMinutes);
        }
        return scheduleDailyReminder(notificationMinutes, strings.reminderTitle, strings.reminderBody);
      })
      .catch(() => {
        showSnackbar(strings.reminderError);
      });
  }, [notificationsEnabled, notificationMinutes, strings.reminderBody, strings.reminderTitle]);

  useEffect(() => {
    if (loading || !fontsLoaded) return;
    if (rateDialogShown.current) return;
    rateDialogShown.current = true;
    recordLaunchAndShouldShow()
      .then(({ shouldShow }) => {
        if (shouldShow) {
          showRateDialogs();
        }
      })
      .catch(() => {});
  }, [loading, fontsLoaded, locale]);

  useEffect(() => {
    let active = true;
    initAds()
      .then(() => {
        if (active) setAdsReady(true);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!adsReady) return;
    interstitialRef.current?.removeAllListeners();
    interstitialRef.current = createInterstitial();
    const unsub = interstitialRef.current.addAdEventListener(AdEventType.CLOSED, () => {
      interstitialRef.current?.load();
    });
    interstitialRef.current.load();
    return () => {
      unsub?.remove?.();
      interstitialRef.current?.removeAllListeners();
    };
  }, [adsReady, adProvider]);

  useEffect(() => {
    if (!showAds) return;
    tabSwitchCount.current += 1;
    if (tabSwitchCount.current % 5 === 0) {
      interstitialRef.current?.show().catch(() => { });
    }
  }, [activeTab, showAds]);

  useEffect(() => {
    analytics().logAppOpen().catch(e => console.log('Analytics log error:', e));
  }, []);

  useEffect(() => {
    initializeIap();
    purchaseListenerRef.current = RNIap.purchaseUpdatedListener(async (purchase: Purchase) => {
      try {
        if (purchase.productId === PREMIUM_PRODUCT_ID) {
          await RNIap.finishTransaction({ purchase, isConsumable: false });
          await markPremiumActive();
          showSnackbar(strings.premiumUnlocked);
        }
      } catch {
        showSnackbar(strings.purchaseFailed, 'error');
      } finally {
        setIapBusy(false);
      }
    });
    purchaseErrorRef.current = RNIap.purchaseErrorListener((_error: PurchaseError) => {
      setIapBusy(false);
      showSnackbar(strings.purchaseFailed, 'error');
    });

    return () => {
      purchaseListenerRef.current?.remove();
      purchaseErrorRef.current?.remove();
      RNIap.endConnection();
    };
  }, [strings.purchaseFailed, strings.premiumUnlocked]);

  useEffect(() => {
    let active = true;
    const loadCities = async () => {
      try {
        await migrateLegacyCities();
        const [storedCity, cityList, storedCustomCities] = await Promise.all([
          getStoredCity(),
          getAllCities(locale),
          getStoredCustomCities(),
        ]);
        if (!active) return;
        const customList = storedCustomCities ?? [];
        setCustomCities(customList);
        setBaseCities(cityList);
        const merged = mergeCities(customList, cityList);
        setCities(merged);
        if (storedCity) {
          const match = merged.find(
            (item) =>
              Math.abs(item.latitude - storedCity.latitude) < 0.001 &&
              Math.abs(item.longitude - storedCity.longitude) < 0.001
          );
          setCity(match ?? storedCity);
        }
      } finally {
        if (active) setCityLoading(false);
      }
    };

    loadCities();

    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const location = city ?? fallbackCity;
    const nowMs = Date.now();
    const moonDaysForDate = sortMoonDays(calcMoonDays(selectedDate, location.latitude, location.longitude, timezone));

    if (moonDaysForDate.length === 0) {
      setMoonDayOptions([]);
      setSelectedMoonDay(null);
      setError('No lunar day data available.');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const isToday = isSameDayInTz(new Date(nowMs), selectedDate, timezone);
    const activeMoonDay = isToday ? pickActiveMoonDay(moonDaysForDate, nowMs) : moonDaysForDate[0];
    const inOptions =
      selectedMoonDay && moonDaysForDate.some((day) => isSameMoonDay(day, selectedMoonDay));
    const shouldAutoSelect = !selectedMoonDay || !isManualMoonDaySelection || !inOptions;
    const effectiveMoonDay = shouldAutoSelect ? activeMoonDay : selectedMoonDay;

    if (active) {
      setMoonDayOptions(moonDaysForDate);
      if (shouldAutoSelect && effectiveMoonDay && !isSameMoonDay(effectiveMoonDay, selectedMoonDay)) {
        setSelectedMoonDay(effectiveMoonDay);
        setIsManualMoonDaySelection(false);
      }
    }

    if (!effectiveMoonDay) {
      setError('No lunar day data available.');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    resolveMoonData(selectedDate, location, locale, strings, timezone, effectiveMoonDay, moonDaysForDate)
      .then((data) => {
        if (!active) return;
        setMoonData(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message ?? 'Unable to load moon data.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDate, city, locale, strings, timezone, selectedMoonDay, isManualMoonDaySelection]);

  useEffect(() => {
    if (!moonData?.moonDay.number) return;
    if (activeTab === 'home' || noteTargetDayId === null) {
      setNoteTargetDayId(moonData.moonDay.number);
    }
  }, [activeTab, moonData?.moonDay.number, noteTargetDayId]);

  useEffect(() => {
    let active = true;
    if (!noteTargetDayId) {
      setCurrentNote(null);
      setNoteDraft('');
      return () => {
        active = false;
      };
    }

    getNoteForMoonDay(noteTargetDayId)
      .then((note) => {
        if (!active) return;
        setCurrentNote(note);
        setNoteDraft(note?.note ?? '');
      })
      .catch(() => {
        if (!active) return;
        setCurrentNote(null);
      });

    return () => {
      active = false;
    };
  }, [getNoteForMoonDay, noteTargetDayId]);

  useEffect(() => {
    let active = true;
    const loadCalendar = async () => {
      setCalendarLoading(true);
      const location = city ?? fallbackCity;
      const monthData = calcMoonMonth(calendarMonth, location.latitude, location.longitude, timezone);
      const dayMap: Record<number, CalendarDayData> = {};

      for (let i = 0; i < monthData.length; i += 1) {
        const lunarDays = monthData[i];
        if (!lunarDays || lunarDays.length === 0) continue;
        const uniqueNumbers = Array.from(new Set(lunarDays.map((day) => day.number))).sort((a, b) => a - b);
        const zodiac = calcMoonZodiac(lunarDays);
        const midDay = moment
          .tz(
            {
              year: calendarMonth.getFullYear(),
              month: calendarMonth.getMonth() + 1,
              day: i + 1,
              hour: 12,
              minute: 0,
              second: 0,
            },
            timezone
          )
          .toDate();
        const illumination = suncalc.getMoonIllumination(midDay);
        dayMap[i + 1] = {
          zodiac,
          lunarDayNumbers: uniqueNumbers,
          illuminationPct: illumination.fraction * 100,
          isWaxing: illumination.phase < 0.5,
        };
      }

      if (!active) return;
      setCalendarData(dayMap);
      setCalendarLoading(false);
    };

    if (activeTab === 'calendar') {
      loadCalendar();
    }

    return () => {
      active = false;
    };
  }, [activeTab, calendarMonth, city, timezone]);

  const filteredCities = useMemo(() => {
    if (!cityQuery) return cities;
    const query = cityQuery.trim().toLowerCase();
    return cities.filter((item) => item.name.toLowerCase().includes(query));
  }, [cityQuery, cities]);

  const formattedDate = useMemo(() => dateFormatter.format(selectedDate), [dateFormatter, selectedDate]);
  const selectedCityName = city?.name ?? fallbackCity.name;

  const moonSignCard = useMemo(() => {
    if (!moonData?.moonSignDescription || moonData.moonSignDescription.trim().length === 0) {
      return null;
    }
    return {
      key: 'moon-sign',
      title: strings.moonSign,
      description: moonData.moonSignDescription.trim(),
      icon: 'brightness-2',
      accent: '#B6A5FF',
    } as CategoryItem;
  }, [moonData, strings.moonSign]);

  const isWaxing = useMemo(() => {
    try {
      const illum = suncalc.getMoonIllumination(selectedDate);
      return illum.phase < 0.5;
    } catch {
      return true;
    }
  }, [selectedDate]);

  const safePercent = (value: number) => (Number.isFinite(value) ? value : 0);

  const handleMoonDaySelect = (day: LunarDay) => {
    setSelectedMoonDay(day);
    setIsManualMoonDaySelection(true);
  };

  const renderCategoryCard = (item: CategoryItem) => {
    const isOpen = !!openCards[item.key];
    return (
      <View key={item.key} style={styles.influenceCard}>
        <Pressable style={styles.influenceHeader} onPress={() => toggleCard(item.key)}>
          <View style={[styles.influenceIconWrap, { backgroundColor: `${item.accent}25`, borderColor: `${item.accent}55` }]}>
            <MaterialIcons name={item.icon} size={20} color={item.accent} />
          </View>
          <Text style={styles.influenceTitle}>{item.title}</Text>
          <MaterialIcons
            name="expand-more"
            size={22}
            color={colors.whiteMuted}
            style={[styles.influenceChevron, isOpen && styles.influenceChevronOpen]}
          />
        </Pressable>
        {isOpen ? (
          <>
            <Text style={styles.influenceText}>{item.description}</Text>
            {item.linkText ? (
              <Pressable style={styles.influenceLinkWrap} onPress={openHealingSounds}>
                <Text style={styles.influenceLinkText}>{item.linkText}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    );
  };

  const renderLockedCategoryCard = (item: CategoryItem) => {
    return (
      <View key={`${item.key}-locked`} style={[styles.influenceCard, styles.lockedCard]}>
        <View style={styles.influenceHeader}>
          <View style={[styles.influenceIconWrap, { backgroundColor: `${item.accent}25`, borderColor: `${item.accent}55` }]}>
            <MaterialIcons name={item.icon} size={20} color={item.accent} />
          </View>
          <Text style={styles.influenceTitle}>{item.title}</Text>
          <MaterialIcons name="lock" size={18} color={colors.whiteMuted} />
        </View>
        <Text style={styles.lockedText}>{strings.premiumLocked}</Text>
        <Pressable style={styles.lockedButton} onPress={openPaywall}>
          <Text style={styles.lockedButtonText}>{strings.premiumCta}</Text>
        </Pressable>
      </View>
    );
  };

  const renderCalendarMoon = (illuminationPct: number, waxing: boolean) => {
    const size = 18;
    const safeIllum = safePercent(illuminationPct);
    const shift = Math.min(size, Math.max(0, (safeIllum / 100) * size));
    return (
      <View style={styles.calendarMoonIcon}>
        <View style={styles.calendarMoonLight} />
        <View
          style={[
            styles.calendarMoonShadow,
            {
              transform: [{ translateX: (waxing ? -1 : 1) * shift }],
            },
          ]}
        />
      </View>
    );
  };

  const zodiacSymbols: Record<string, string> = {
    aries: '♈',
    taurus: '♉',
    gemini: '♊',
    cancer: '♋',
    leo: '♌',
    virgo: '♍',
    libra: '♎',
    scorpio: '♏',
    sagittarius: '♐',
    capricorn: '♑',
    aquarius: '♒',
    pisces: '♓',
  };

  const buildMonthGrid = (monthDate: Date, weekStartsOnMonday: boolean) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startIndex = firstDay.getDay();
    const offset = weekStartsOnMonday ? (startIndex + 6) % 7 : startIndex;
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    const cells: Array<Date | null> = [];
    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - offset + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.push(null);
      } else {
        cells.push(new Date(year, month, dayNumber));
      }
    }
    return cells;
  };

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(deviceLocale, {
      month: 'long',
      year: 'numeric',
      timeZone: timezone,
    }).format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
  }, [calendarMonth, deviceLocale, timezone]);

  const calendarCells = useMemo(
    () => buildMonthGrid(calendarMonth, strings.weekStartsOnMonday),
    [calendarMonth, strings.weekStartsOnMonday]
  );

  const handleMonthShift = (delta: number) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const formatReminderTime = (minutes: number) => {
    const base = new Date();
    base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return timeFormatter.format(base);
  };

  const updateReminderMinutes = (next: number) => {
    setNotificationMinutes(next);
    setStoredNotifications(notificationsEnabled, next).catch(() => {
      setError('Unable to save reminder time.');
    });
  };

  const adjustReminderTime = (deltaMinutes: number) => {
    const next = (notificationMinutes + deltaMinutes + 1440) % 1440;
    updateReminderMinutes(next);
  };

  const handleTimePickerChange = (_event: any, date?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowTimePicker(false);
    }
    if (!date) return;
    updateReminderMinutes(date.getHours() * 60 + date.getMinutes());
  };

  const handleCitySelect = async (selected: City) => {
    setCity(selected);
    setCityPickerVisible(false);
    setCityQuery('');
    try {
      await setStoredCity(selected);
    } catch (err) {
      setError('Unable to save city selection.');
    }
  };

  const handleLanguageSelect = async (language: AppLocale) => {
    setLocale(language);
    try {
      await setStoredLanguage(language);
    } catch (err) {
      setError('Unable to save language selection.');
    }
  };

  const openPlayStore = async () => {
    const storeUrl = 'market://details?id=com.crbee.mooncalendar';
    const webUrl = 'https://play.google.com/store/apps/details?id=com.crbee.mooncalendar';
    try {
      const canStore = await Linking.canOpenURL(storeUrl);
      if (canStore) {
        await Linking.openURL(storeUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  const showRateDialogs = () => {
    setRateStep('enjoy');
  };

  const openHealingSounds = async () => {
    const appUrl = 'android-app://com.dailymistika.healingsounds';
    const storeUrl = 'market://details?id=com.dailymistika.healingsounds';
    const webUrl = 'https://play.google.com/store/apps/details?id=com.dailymistika.healingsounds';
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        await Linking.openURL(appUrl);
        return;
      }
      const canStore = await Linking.canOpenURL(storeUrl);
      if (canStore) {
        await Linking.openURL(storeUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch (err) {
      await Linking.openURL(webUrl);
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // no-op
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await ensureNotificationPermissions();
      if (!granted) {
        setNotificationsEnabled(false);
        await setStoredNotifications(false, notificationMinutes);
        return;
      }
      setNotificationsEnabled(true);
      try {
        await setStoredNotifications(true, notificationMinutes);
      } catch (err) {
        setError('Unable to save notification settings.');
      }
      return;
    }

    setNotificationsEnabled(false);
    try {
      await cancelDailyReminder();
      await setStoredNotifications(false, notificationMinutes);
    } catch (err) {
      setError('Unable to save notification settings.');
    }
  };

  const handleTextSizeSelect = async (size: 'small' | 'medium' | 'large') => {
    setTextSize(size);
    try {
      await setStoredTextSize(size);
    } catch (err) {
      setError('Unable to save text size.');
    }
  };

  const handleThemeSelect = async (nextTheme: ThemeName) => {
    setThemeName(nextTheme);
    try {
      await setStoredTheme(nextTheme);
    } catch (err) {
      setError('Unable to save theme selection.');
    }
  };

  const handleSaveNote = async () => {
    if (!noteTargetDayId) return;
    const trimmed = noteDraft.trim();
    if (!trimmed) {
      Alert.alert(strings.notesTitle, strings.notePlaceholder);
      return;
    }
    setNotesBusy(true);
    try {
      await saveNote(noteTargetDayId, trimmed, currentNote?.id);
      const updated = await getNoteForMoonDay(noteTargetDayId);
      setCurrentNote(updated);
      setNoteDraft(updated?.note ?? '');
    } catch (err) {
      setError('Unable to save note.');
    } finally {
      setNotesBusy(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!currentNote) return;
    setNotesBusy(true);
    try {
      await removeNote(currentNote.id);
      setCurrentNote(null);
      setNoteDraft('');
    } catch (err) {
      setError('Unable to delete note.');
    } finally {
      setNotesBusy(false);
    }
  };

  const handleSelectNote = (note: NoteRecord) => {
    if (note.moonDayId) {
      setNoteTargetDayId(note.moonDayId);
    }
    setCurrentNote(note);
    setNoteDraft(note.note);
  };

  const handleExportNotes = async () => {
    try {
      await exportNotes();
      showSnackbar(strings.exportNotes);
    } catch (err) {
      showSnackbar(strings.importFailed, 'error');
    }
  };

  const handleImportNotes = async () => {
    try {
      const { imported } = await importNotes();
      if (imported !== undefined) {
        showSnackbar(strings.importSuccess(imported));
        // reload notes
        const fresh = await getAllNotes();
        setCurrentNote(null);
        setNoteDraft('');
        // use hook refresh by reloading
        await refreshNotes();
      }
    } catch (err) {
      showSnackbar(strings.importFailed, 'error');
    }
  };

  const showSnackbar = (message: string, type: 'info' | 'error' = 'info') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
    if (snackbarTimeout.current) {
      clearTimeout(snackbarTimeout.current);
    }
    snackbarTimeout.current = setTimeout(() => {
      setSnackbarVisible(false);
    }, 2200);
  };

  const markPremiumActive = async () => {
    setIsPremium(true);
    setPaywallVisible(false);
    try {
      await setStoredPremium(true);
    } catch (err) {
      setError('Unable to save premium status.');
    }
  };

  const initializeIap = async () => {
    try {
      const connected = await RNIap.initConnection();
      if (!connected) return;
      if (Platform.OS === 'android') {
        await RNIap.flushFailedPurchasesCachedAsPendingAndroid();
      }
      await RNIap.getProducts({ skus: [PREMIUM_PRODUCT_ID] });
      setIapReady(true);
      const available = await RNIap.getAvailablePurchases();
      const hasPremium = available.some((purchase) => purchase.productId === PREMIUM_PRODUCT_ID);
      if (hasPremium) {
        await markPremiumActive();
      }
    } catch (err) {
      // keep silent, user can still use the app without IAP
    }
  };

  const handleSaveCustomCity = async () => {
    const name = customCityName.trim();
    const lat = Number(customLatitude.replace(',', '.'));
    const lon = Number(customLongitude.replace(',', '.'));
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      Alert.alert(strings.customCityTitle, strings.invalidCustomCity);
      return;
    }
    const customCity: CustomCityRecord = {
      id: editingCustomCityId ?? `custom-${Date.now()}`,
      name,
      latitude: lat,
      longitude: lon,
    };
    try {
      const nextCustomCities = editingCustomCityId
        ? customCities.map((item) => (item.id === editingCustomCityId ? customCity : item))
        : [customCity, ...customCities];
      setCustomCities(nextCustomCities);
      await setStoredCustomCities(nextCustomCities);
      await setStoredCity(customCity);
      setCity(customCity);
      setCities(mergeCities(nextCustomCities, baseCities));
      setCustomCityName('');
      setCustomLatitude('');
      setCustomLongitude('');
      setEditingCustomCityId(null);
      showSnackbar(strings.citySaved);
    } catch (err) {
      setError('Unable to save custom city.');
    }
  };

  const handleEditCustomCity = (city: CustomCityRecord) => {
    setCustomCityName(city.name);
    setCustomLatitude(String(city.latitude));
    setCustomLongitude(String(city.longitude));
    setEditingCustomCityId(city.id);
  };

  const handleDeleteCustomCity = async (customCity: CustomCityRecord) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(strings.deleteCityTitle, strings.deleteCityMessage, [
        { text: strings.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: strings.delete, style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;

    const nextCustomCities = customCities.filter((item) => item.id !== customCity.id);
    setCustomCities(nextCustomCities);
    setCities(mergeCities(nextCustomCities, baseCities));

    if (editingCustomCityId === customCity.id) {
      setEditingCustomCityId(null);
      setCustomCityName('');
      setCustomLatitude('');
      setCustomLongitude('');
    }

    const selectedMatches =
      city &&
      Math.abs(city.latitude - customCity.latitude) < 0.001 &&
      Math.abs(city.longitude - customCity.longitude) < 0.001;

    if (selectedMatches) {
      const nextCity =
        nextCustomCities[0] ??
        baseCities[0] ?? {
          name: fallbackCity.name,
          latitude: fallbackCity.latitude,
          longitude: fallbackCity.longitude,
        };
      setCity(nextCity);
      await setStoredCity(nextCity);
    }

    await setStoredCustomCities(nextCustomCities);
  };

  const openPaywall = () => {
    setPaywallVisible(true);
  };

  const handleUnlockPremium = async () => {
    if (iapBusy) return;
    setIapBusy(true);
    try {
      if (!iapReady) {
        await initializeIap();
      }
      await RNIap.requestPurchase({
        type: 'in-app',
        request: {
          google: {
            skus: [PREMIUM_PRODUCT_ID],
          },
        },
      });
    } catch (err) {
      showSnackbar(strings.purchaseFailed, 'error');
      setIapBusy(false);
    }
  };

  const handleRestorePremium = async () => {
    if (iapBusy) return;
    setIapBusy(true);
    try {
      if (!iapReady) {
        await initializeIap();
      }
      const available = await RNIap.getAvailablePurchases();
      const hasPremium = available.some((purchase) => purchase.productId === PREMIUM_PRODUCT_ID);
      if (hasPremium) {
        await markPremiumActive();
        showSnackbar(strings.restoreSuccess);
      } else {
        showSnackbar(strings.restoreNone);
      }
    } catch (err) {
      showSnackbar(strings.purchaseFailed, 'error');
    } finally {
      setIapBusy(false);
    }
  };

  const toggleCard = (key: string) => {
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.white} />
      </SafeAreaView>
    );
  }

  const appConfig = require('./app.json');
  const appVersion = appConfig?.expo?.version ?? '0.1.0';
  const activeColor = (tab: typeof activeTab) => (activeTab === tab ? colors.white : colors.whiteMuted);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient colors={theme.gradient} style={styles.gradient}>
        <View style={[styles.subHeader, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.subtitle}>{strings.appSubtitle}</Text>
        </View>
        <View style={styles.navWrap}>
          <View style={styles.navPill}>
            <Pressable
              style={[styles.navItem, activeTab === 'home' && styles.navActive]}
              onPress={() => setActiveTab('home')}
            >
              <MaterialIcons name="home" size={20} color={activeColor('home')} />
            </Pressable>
            <Pressable
              style={[styles.navItem, activeTab === 'calendar' && styles.navActive]}
              onPress={() => setActiveTab('calendar')}
            >
              <MaterialIcons name="event-note" size={20} color={activeColor('calendar')} />
            </Pressable>
            <Pressable
              style={[styles.navItem, activeTab === 'notes' && styles.navActive]}
              onPress={() => setActiveTab('notes')}
            >
              <MaterialIcons name="edit" size={20} color={activeColor('notes')} />
            </Pressable>
            <Pressable
              style={[styles.navItem, activeTab === 'profile' && styles.navActive]}
              onPress={() => setActiveTab('profile')}
            >
              <MaterialIcons name="person" size={20} color={activeColor('profile')} />
            </Pressable>
          </View>
        </View>

        {activeTab === 'home' && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, showAds && { paddingBottom: 110 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : error ? (
              <View style={styles.centerBlock}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : moonData ? (
              <>
                <View style={styles.dateRow}>
                  <Pressable
                    onPress={() => setSelectedDate((prev) => new Date(prev.getTime() - 86400000))}
                    style={styles.chevronButton}
                  >
                    <MaterialIcons name="chevron-left" size={26} color={colors.whiteMuted} />
                  </Pressable>
                  <Text style={styles.dateText}>{formattedDate}</Text>
                  <Pressable
                    onPress={() => {
                      const next = new Date(selectedDate.getTime() + 86400000);
                      setSelectedDate(next);
                    }}
                    style={styles.chevronButton}
                  >
                    <MaterialIcons name="chevron-right" size={26} color={colors.whiteMuted} />
                  </Pressable>
                </View>

                <View style={styles.hero}>
                  <View style={styles.moonHaloOne} />
                  <View style={styles.moonHaloTwo} />
                  <View style={[styles.moonSphere, shadows.glow]}>
                    <View style={styles.moonSurface} />
                    <View style={styles.moonCraterOne} />
                    <View style={styles.moonCraterTwo} />
                    <View style={styles.moonCraterThree} />
                    <View
                      style={[
                        styles.moonShadow,
                        {
                          transform: [
                            {
                              translateX:
                                (isWaxing ? -1 : 1) *
                                Math.min(190, Math.max(0, (safePercent(moonData.illuminationPct) / 100) * 190)),
                            },
                          ],
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={
                          moonData.moonDay.number <= 15
                            ? ['rgba(10,10,20,0.9)', 'rgba(10,10,20,0)']
                            : ['rgba(10,10,20,0)', 'rgba(10,10,20,0.9)']
                        }
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.moonShadowGradient}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.centerColumn}>
                  <Text style={styles.phaseTitle}>{strings.phaseLabels[moonData.moonPhase] ?? moonData.moonPhase}</Text>
                  <View style={styles.phaseMeta}>
                    <View style={styles.pillTag}>
                      <Text style={styles.pillText}>{`${Math.round(moonData.illuminationPct)}% ${strings.illumination}`}</Text>
                    </View>
                    <Text style={styles.phaseHint}>
                      {moonData.daysToFullMoon === null
                        ? strings.fullMoon
                        : strings.daysToFullMoon(moonData.daysToFullMoon)}
                    </Text>
                  </View>

                  <View style={styles.infoCard}>
                    <Pressable style={styles.infoRow} onPress={() => setCityPickerVisible(true)}>
                      <Text style={styles.infoLabel}>{strings.city}</Text>
                      <View style={styles.infoValueRow}>
                        <Text style={styles.infoValue}>{cityLoading ? 'Loading...' : selectedCityName}</Text>
                        <MaterialIcons name="expand-more" size={18} color={colors.whiteMuted} />
                      </View>
                    </Pressable>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{strings.moonSign}</Text>
                      <Text style={styles.infoValue}>{moonData.moonSign}</Text>
                    </View>
                    <View style={styles.infoStack}>
                      <Text style={styles.infoValue}>{`${strings.lunarDay} ${moonData.moonDay.number}`}</Text>
                    </View>
                    {moonDayOptions.length > 0 ? (
                      <>
                        <View style={styles.lunarDayRanges}>
                          {moonDayOptions.map((day) => (
                            <Pressable
                              key={`${day.number}-${day.end}`}
                              onPress={() => handleMoonDaySelect(day)}
                              style={[
                                styles.lunarDayRangeRow,
                                selectedMoonDay && isSameMoonDay(selectedMoonDay, day) && styles.lunarDayRangeRowActive,
                              ]}
                            >
                              <View style={styles.lunarDayRangeBadge}>
                                <Text style={styles.lunarDayRangeNumber}>{day.number}</Text>
                                <Text style={styles.lunarDayRangeLabel}>{strings.lunarDay}</Text>
                              </View>
                              <View style={styles.lunarDayRangeColumn}>
                                <Text
                                  style={[
                                    styles.lunarDayRangeText,
                                    selectedMoonDay && isSameMoonDay(selectedMoonDay, day) && styles.lunarDayRangeTextActive,
                                  ]}
                                >
                                  {formatLunarStart(day)}
                                </Text>
                                <Text
                                  style={[
                                    styles.lunarDayRangeText,
                                    selectedMoonDay && isSameMoonDay(selectedMoonDay, day) && styles.lunarDayRangeTextActive,
                                  ]}
                                >
                                  {formatLunarEnd(day)}
                                </Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>

                  <View style={styles.notesCard}>
                    <View style={styles.notesHeaderRow}>
                      <Text style={styles.notesTitle}>{strings.notesTitle}</Text>
                      <Pressable style={styles.notesLink} onPress={() => setActiveTab('notes')}>
                        <Text style={styles.notesLinkText}>{strings.notesListTitle}</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.notesSubtitle}>
                      {noteTargetDayId ? strings.noteForDay(noteTargetDayId) : strings.notesSubtitle}
                    </Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder={strings.notePlaceholder}
                      placeholderTextColor={colors.whiteMuted}
                      value={noteDraft}
                      onChangeText={setNoteDraft}
                      multiline
                      editable={!!noteTargetDayId}
                    />
                    <View style={styles.notesActions}>
                      <Pressable
                        style={[styles.notesPrimaryButton, (!noteDraft.trim() || notesBusy) && styles.notesButtonDisabled]}
                        onPress={handleSaveNote}
                        disabled={!noteDraft.trim() || notesBusy || !noteTargetDayId}
                      >
                        <Text style={styles.notesPrimaryText}>{strings.noteSave}</Text>
                      </Pressable>
                      {currentNote ? (
                        <Pressable
                          style={[styles.notesGhostButton, notesBusy && styles.notesButtonDisabled]}
                          onPress={handleDeleteNote}
                          disabled={notesBusy}
                        >
                          <Text style={styles.notesGhostText}>{strings.noteDelete}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {notesError ? <Text style={styles.notesError}>{notesError}</Text> : null}
                  </View>
                </View>

                {moonSignCard ? <View style={styles.influenceSection}>{renderCategoryCard(moonSignCard)}</View> : null}

                <View style={styles.influenceSection}>
                  <Text style={styles.sectionLabel}>{strings.dailyInfluences}</Text>
                  {moonData.categories.length === 0 ? (
                    <Text style={styles.emptyText}>{strings.noCategoryData}</Text>
                  ) : (
                    moonData.categories.map((item, index) => (
                      <React.Fragment key={item.key}>
                        {renderCategoryCard(item)}
                        {showAds && (index + 1) % 4 === 0 ? <NativeAdSlot adUnitId={nativeUnitId} /> : null}
                      </React.Fragment>
                    ))
                  )}
                </View>
              </>
            ) : null}
          </ScrollView>
        )}

        {activeTab === 'calendar' && (
          <View style={[styles.calendarSection, showAds && { paddingBottom: 110 + insets.bottom }]}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => handleMonthShift(-1)} style={styles.calendarNavButton}>
                <MaterialIcons name="chevron-left" size={22} color={colors.whiteMuted} />
              </Pressable>
              <Text style={styles.calendarTitle}>{monthLabel}</Text>
              <Pressable onPress={() => handleMonthShift(1)} style={styles.calendarNavButton}>
                <MaterialIcons name="chevron-right" size={22} color={colors.whiteMuted} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {strings.weekdays.map((label) => (
                <Text key={label} style={styles.weekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            {calendarLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : (
              <View style={styles.calendarGrid}>
                {calendarCells.map((cell, index) => {
                  if (!cell) {
                    return <View key={`empty-${index}`} style={styles.calendarCellEmpty} />;
                  }
                  const dayNumber = cell.getDate();
                  const data = calendarData[dayNumber];
                  const zodiacSymbol = data ? zodiacSymbols[data.zodiac] : '';
                  const lunarLabel = data ? data.lunarDayNumbers.join('·') : '';
                  const illuminationPct = data?.illuminationPct ?? 0;
                  const isWaxingDay = data?.isWaxing ?? true;
                  const today = isSameDay(cell, new Date());
                  const isSelected = isSameDay(cell, selectedDate);

                  return (
                    <Pressable
                      key={cell.toISOString()}
                      style={[
                        styles.calendarCell,
                        today && styles.calendarCellToday,
                        isSelected && styles.calendarCellSelected,
                      ]}
                      onPress={() => {
                        setSelectedDate(cell);
                        setActiveTab('home');
                      }}
                    >
                      <Text style={styles.calendarDay}>{dayNumber}</Text>
                      <Text style={styles.calendarZodiac}>{zodiacSymbol}</Text>
                      <View style={styles.calendarMoonRow}>
                        {renderCalendarMoon(illuminationPct, isWaxingDay)}
                        <Text style={styles.calendarMoonText}>{lunarLabel}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {activeTab === 'notes' && (
          <ScrollView
            contentContainerStyle={[styles.notesContent, showAds && { paddingBottom: 110 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.notesHeader}>
              <Text style={styles.notesTitleLarge}>{strings.notesTitle}</Text>
              <Text style={styles.notesSubtitle}>{strings.notesSubtitle}</Text>
            </View>

            <View style={styles.notesCard}>
              <Text style={styles.notesSubtitle}>
                {noteTargetDayId ? strings.noteForDay(noteTargetDayId) : strings.notesSubtitle}
              </Text>
              <View style={styles.notesExportRow}>
                <Pressable style={styles.notesGhostButton} onPress={handleExportNotes} disabled={notesBusy}>
                  <Text style={styles.notesGhostText}>{strings.exportNotes}</Text>
                </Pressable>
                <Pressable style={styles.notesGhostButton} onPress={handleImportNotes} disabled={notesBusy}>
                  <Text style={styles.notesGhostText}>{strings.importNotes}</Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.notesInput}
                placeholder={strings.notePlaceholder}
                placeholderTextColor={colors.whiteMuted}
                value={noteDraft}
                onChangeText={setNoteDraft}
                multiline
                editable={!!noteTargetDayId}
              />
              <View style={styles.notesActions}>
                <Pressable
                  style={[styles.notesPrimaryButton, (!noteDraft.trim() || notesBusy) && styles.notesButtonDisabled]}
                  onPress={handleSaveNote}
                  disabled={!noteDraft.trim() || notesBusy || !noteTargetDayId}
                >
                  <Text style={styles.notesPrimaryText}>{strings.noteSave}</Text>
                </Pressable>
                {currentNote ? (
                  <Pressable
                    style={[styles.notesGhostButton, notesBusy && styles.notesButtonDisabled]}
                    onPress={handleDeleteNote}
                    disabled={notesBusy}
                  >
                    <Text style={styles.notesGhostText}>{strings.noteDelete}</Text>
                  </Pressable>
                ) : null}
              </View>
              {notesError ? <Text style={styles.notesError}>{notesError}</Text> : null}
            </View>

            <View style={styles.notesListSection}>
              <Text style={styles.sectionLabel}>{strings.notesListTitle}</Text>
              {notesLoading ? (
                <View style={styles.centerBlock}>
                  <ActivityIndicator color={colors.white} />
                </View>
              ) : notes.length === 0 ? (
                <Text style={styles.emptyText}>{strings.notesEmpty}</Text>
              ) : (
                notes.map((note) => {
                  const title = note.moonDayId ? `${strings.lunarDay} ${note.moonDayId}` : note.dateKey;
                  return (
                    <Pressable key={note.id} style={styles.noteItem} onPress={() => handleSelectNote(note)}>
                      <View style={styles.noteItemHeader}>
                        <Text style={styles.noteItemTitle}>{title}</Text>
                        <Text style={styles.noteItemEdit}>{strings.noteEdit}</Text>
                      </View>
                      <Text style={styles.noteItemBody}>{note.note}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}

        {activeTab === 'profile' && (
          <ScrollView
            contentContainerStyle={[styles.profileContent, showAds && { paddingBottom: 110 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.profileTitle}>{strings.profileTitle}</Text>

            {otherApps.length > 0 ? (
              <View style={styles.moreAppsSection}>
                <Text style={styles.moreAppsLabel}>{strings.moreApps}</Text>
                <FlatList
                  data={otherApps}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, index) => `${item.name}-${index}`}
                  contentContainerStyle={styles.moreAppsList}
                  renderItem={({ item }) => (
                    <Pressable style={styles.moreAppCard} onPress={() => openExternalLink(item.link)}>
                      <View style={styles.moreAppIconWrap}>
                        <Image source={{ uri: item.imageLink }} style={styles.moreAppIcon} />
                      </View>
                      <Text style={styles.moreAppName} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
            ) : null}

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.language}</Text>
              <View style={styles.profileOptionGroup}>
                <Pressable
                  style={[styles.profileOptionButton, locale === 'en' && styles.profileOptionButtonActive]}
                  onPress={() => handleLanguageSelect('en')}
                >
                  <Text style={styles.profileOptionButtonText}>{strings.english}</Text>
                </Pressable>
                <Pressable
                  style={[styles.profileOptionButton, locale === 'ru' && styles.profileOptionButtonActive]}
                  onPress={() => handleLanguageSelect('ru')}
                >
                  <Text style={styles.profileOptionButtonText}>{strings.russian}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.theme}</Text>
              <View style={styles.profileOptionGroupWrap}>
                {[
                  { key: 'blue-day', label: strings.themeBlueDay },
                  { key: 'deep-blue-night', label: strings.themeDeepBlueNight },
                  { key: 'raspberry', label: strings.themeRaspberry },
                  { key: 'dreamland', label: strings.themeDreamland },
                  { key: 'amethyst', label: strings.themeAmethyst },
                ].map((option) => {
                  const name = option.key as ThemeName;
                  const preview = themes[name].gradient;
                  return (
                    <Pressable
                      key={option.key}
                      style={[
                        styles.profileThemeButton,
                        themeName === name && styles.profileOptionButtonActive,
                      ]}
                      onPress={() => handleThemeSelect(name)}
                    >
                      <View style={styles.themePreviewRow}>
                        {preview.map((color, index) => (
                          <View key={`${option.key}-${index}`} style={[styles.themeSwatch, { backgroundColor: color }]} />
                        ))}
                      </View>
                      <Text style={styles.profileOptionButtonText} numberOfLines={2}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.textSize}</Text>
              <View style={styles.profileOptionGroup}>
                <Pressable
                  style={[styles.profileOptionButton, textSize === 'small' && styles.profileOptionButtonActive]}
                  onPress={() => handleTextSizeSelect('small')}
                >
                  <Text style={styles.profileOptionButtonText}>{strings.sizeSmall}</Text>
                </Pressable>
                <Pressable
                  style={[styles.profileOptionButton, textSize === 'medium' && styles.profileOptionButtonActive]}
                  onPress={() => handleTextSizeSelect('medium')}
                >
                  <Text style={styles.profileOptionButtonText}>{strings.sizeMedium}</Text>
                </Pressable>
                <Pressable
                  style={[styles.profileOptionButton, textSize === 'large' && styles.profileOptionButtonActive]}
                  onPress={() => handleTextSizeSelect('large')}
                >
                  <Text style={styles.profileOptionButtonText}>{strings.sizeLarge}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.city}</Text>
              <Pressable style={styles.profileRow} onPress={() => setCityPickerVisible(true)}>
                <Text style={styles.profileRowLabel}>{strings.city}</Text>
                <View style={styles.profileRowValue}>
                  <Text style={styles.profileRowText}>{cityLoading ? 'Loading...' : selectedCityName}</Text>
                  <MaterialIcons name="chevron-right" size={18} color={colors.whiteMuted} />
                </View>
              </Pressable>
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>Timezone</Text>
                <Text style={styles.profileRowText}>{timezone}</Text>
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.customCityTitle}</Text>
              <View style={styles.profileField}>
                <Text style={styles.profileRowLabel}>{strings.cityNameLabel}</Text>
                <TextInput
                  style={styles.profileInput}
                  placeholder={strings.city}
                  placeholderTextColor={colors.whiteMuted}
                  value={customCityName}
                  onChangeText={setCustomCityName}
                />
              </View>
              <View style={styles.profileField}>
                <Text style={styles.profileRowLabel}>{strings.latitudeLabel}</Text>
                <TextInput
                  style={styles.profileInput}
                  placeholder="0.0000"
                  placeholderTextColor={colors.whiteMuted}
                  value={customLatitude}
                  onChangeText={setCustomLatitude}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.profileField}>
                <Text style={styles.profileRowLabel}>{strings.longitudeLabel}</Text>
                <TextInput
                  style={styles.profileInput}
                  placeholder="0.0000"
                  placeholderTextColor={colors.whiteMuted}
                  value={customLongitude}
                  onChangeText={setCustomLongitude}
                  keyboardType="numeric"
                />
              </View>
              <Pressable style={styles.profileSaveButton} onPress={handleSaveCustomCity}>
                <Text style={styles.profileSaveButtonText}>{strings.saveCustomCity}</Text>
              </Pressable>
              {customCities.length === 0 ? (
                <Text style={styles.customCityEmpty}>{strings.noCustomCities}</Text>
              ) : (
                customCities.map((item) => (
                  <View key={item.id} style={styles.customCityRow}>
                    <View style={styles.customCityInfo}>
                      <Text style={styles.customCityName}>{item.name}</Text>
                      <Text style={styles.customCityCoords}>
                        {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                      </Text>
                    </View>
                    <View style={styles.customCityActions}>
                      <Pressable style={styles.customCityAction} onPress={() => handleEditCustomCity(item)}>
                        <Text style={styles.customCityActionText}>{strings.edit}</Text>
                      </Pressable>
                      <Pressable style={styles.customCityAction} onPress={() => handleDeleteCustomCity(item)}>
                        <Text style={styles.customCityActionText}>{strings.delete}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.notifications}</Text>
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{strings.dailyReminder}</Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ true: colors.jade, false: 'rgba(255,255,255,0.12)' }}
                  thumbColor={colors.white}
                />
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{strings.reminderTime}</Text>
                <View style={styles.reminderControls}>
                  <Pressable onPress={() => adjustReminderTime(-15)} style={styles.reminderButton}>
                    <MaterialIcons name="remove" size={18} color={colors.white} />
                  </Pressable>
                  <Pressable style={styles.reminderTimeChip} onPress={() => setShowTimePicker((prev) => !prev)}>
                    <Text style={styles.reminderTimeText}>{formatReminderTime(notificationMinutes)}</Text>
                  </Pressable>
                  <Pressable onPress={() => adjustReminderTime(15)} style={styles.reminderButton}>
                    <MaterialIcons name="add" size={18} color={colors.white} />
                  </Pressable>
                </View>
              </View>
              {showTimePicker ? (
                <View style={styles.reminderPickerWrap}>
                  <DateTimePicker
                    value={reminderDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimePickerChange}
                  />
                  {Platform.OS === 'ios' ? (
                    <Pressable style={styles.reminderDone} onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.reminderDoneText}>Done</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.premium}</Text>
              {isPremium ? (
                <View style={styles.profileRow}>
                  <Text style={styles.profileRowLabel}>{strings.premium}</Text>
                  <Text style={styles.profileRowText}>{strings.premiumActive}</Text>
                </View>
              ) : (
                <Pressable style={styles.profileActionRow} onPress={openPaywall}>
                  <Text style={styles.profileRowLabel}>{strings.premiumCta}</Text>
                  <MaterialIcons name="chevron-right" size={18} color={colors.whiteMuted} />
                </Pressable>
              )}
              <Pressable style={styles.profileActionRow} onPress={handleRestorePremium}>
                <Text style={styles.profileRowLabel}>{strings.restorePurchase}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.whiteMuted} />
              </Pressable>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.support}</Text>
              <Pressable
                style={styles.profileActionRow}
                onPress={() => Linking.openURL('mailto:support@mooncalendar.app')}
              >
                <Text style={styles.profileRowLabel}>{strings.feedback}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.whiteMuted} />
              </Pressable>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>{strings.about}</Text>
              <Pressable
                style={styles.profileActionRow}
                onPress={() => Linking.openURL('https://cbeeapps.wixsite.com/moonprivacypolicy')}
              >
                <Text style={styles.profileRowLabel}>{strings.privacyPolicy}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.whiteMuted} />
              </Pressable>
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{strings.version}</Text>
                <Text style={styles.profileRowText}>{appVersion}</Text>
              </View>
            </View>

          </ScrollView>
        )}

        {showAds ? (
          <View style={[styles.bannerDock, { paddingBottom: Platform.OS === 'android' ? 0 : insets.bottom }]}>
            <Banner width={bannerWidth} />
          </View>
        ) : null}

        <Modal visible={rateStep !== 'none'} animationType="fade" transparent>
          <View style={styles.rateOverlay}>
            <View style={styles.rateSheet}>
              <View style={styles.rateHeaderRow}>
                <View style={styles.rateIconWrap}>
                  <MaterialIcons name="stars" size={22} color={colors.lavender} />
                </View>
                <View style={styles.rateHeaderText}>
                  <Text style={styles.rateTitle}>
                    {rateStep === 'enjoy' ? strings.rateEnjoyTitle : strings.rateTitle}
                  </Text>
                  <Text style={styles.rateSubtitle}>{strings.rateAppTitle}</Text>
                </View>
              </View>
              <Text style={styles.rateBody}>
                {rateStep === 'enjoy' ? strings.rateEnjoyBody : strings.rateBody}
              </Text>
              {rateStep === 'enjoy' ? (
                <View style={styles.rateActionsColumn}>
                  <Pressable
                    style={[styles.rateButton, styles.rateButtonPrimary]}
                    onPress={() => setRateStep('rate')}
                  >
                    <Text style={styles.rateButtonPrimaryText}>{strings.rateYes}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.rateButton, styles.rateButtonGhost]}
                    onPress={() => {
                      setDoNotShowAgain(true);
                      setRateStep('none');
                    }}
                  >
                    <Text style={styles.rateButtonGhostText}>{strings.rateNo}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.rateActionsColumn}>
                  <Pressable
                    style={[styles.rateButton, styles.rateButtonPrimary]}
                    onPress={() => {
                      setDoNotShowAgain(true);
                      setRateStep('none');
                      openPlayStore();
                    }}
                  >
                    <Text style={styles.rateButtonPrimaryText}>{strings.rateNow}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.rateButton, styles.rateButtonOutline]}
                    onPress={() => {
                      remindLater();
                      setRateStep('none');
                    }}
                  >
                    <Text style={styles.rateButtonOutlineText}>{strings.rateLater}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.rateButton, styles.rateButtonGhost]}
                    onPress={() => {
                      setDoNotShowAgain(true);
                      setRateStep('none');
                    }}
                  >
                    <Text style={styles.rateButtonGhostText}>{strings.rateNoThanks}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={cityPickerVisible} animationType="slide" transparent>
          <Pressable style={styles.modalBackdrop} onPress={() => setCityPickerVisible(false)}>
            <Pressable style={styles.modalSheet} onPress={() => { }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{strings.chooseCity}</Text>
                <Pressable onPress={() => setCityPickerVisible(false)}>
                  <MaterialIcons name="close" size={20} color={colors.white} />
                </Pressable>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder={strings.searchCities}
                placeholderTextColor={colors.whiteMuted}
                value={cityQuery}
                onChangeText={setCityQuery}
              />
              <FlatList
                data={filteredCities}
                keyExtractor={(item) => item.name}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.cityList}
                ListEmptyComponent={<Text style={styles.emptyText}>{strings.noCities}</Text>}
                renderItem={({ item }) => (
                  <Pressable style={styles.cityRow} onPress={() => handleCitySelect(item)}>
                    <Text style={styles.cityName}>{item.name}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.whiteMuted} />
                  </Pressable>
                )}
              />
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={paywallVisible} animationType="slide" transparent>
          <View style={styles.paywallBackdrop}>
            <LinearGradient colors={theme.gradient} style={styles.paywallSheet}>
              <View style={styles.paywallHeader}>
                <Text style={styles.paywallTitle}>{strings.premiumTitle}</Text>
                <Text style={styles.paywallSubtitle}>{strings.premiumSubtitle}</Text>
              </View>
              <View style={styles.paywallList}>
                {strings.premiumBenefits.map((item) => (
                  <View key={item} style={styles.paywallRow}>
                    <MaterialIcons name="check-circle" size={18} color={colors.jade} />
                    <Text style={styles.paywallText}>{item}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.paywallActions}>
                <Pressable style={[styles.paywallPrimary, iapBusy && styles.paywallButtonDisabled]} onPress={handleUnlockPremium} disabled={iapBusy}>
                  <Text style={styles.paywallPrimaryText}>{strings.premiumCta}</Text>
                </Pressable>
                <Pressable style={[styles.paywallSecondary, iapBusy && styles.paywallButtonDisabled]} onPress={handleRestorePremium} disabled={iapBusy}>
                  <Text style={styles.paywallSecondaryText}>{strings.premiumRestore}</Text>
                </Pressable>
                <Pressable style={styles.paywallTertiary} onPress={() => setPaywallVisible(false)}>
                  <Text style={styles.paywallTertiaryText}>{strings.premiumNotNow}</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </Modal>
        {snackbarVisible ? (
          <View style={[styles.snackbar, { bottom: 24 + insets.bottom }]}>
            <Text style={styles.snackbarText}>{snackbarMessage}</Text>
          </View>
        ) : null}
      </LinearGradient>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const createStyles = (scale: number, theme: typeof themes.raspberry) => {
  const fs = (value: number) => value * scale + 3;
  const ls = (value: number) => value * scale;
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.charcoal,
    },
    gradient: {
      flex: 1,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    navWrap: {
      paddingHorizontal: 24,
      marginTop: 8,
    },
    subHeader: {
      paddingHorizontal: 24,
      paddingTop: 10,
      paddingBottom: 6,
    },
    navPill: {
      flexDirection: 'row',
      backgroundColor: theme.navBg,
      borderColor: theme.navBorder,
      borderWidth: 1,
      borderRadius: 999,
      padding: 6,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    navActive: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 999,
    },
    subtitle: {
      color: theme.subtitle,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(10),
      letterSpacing: ls(2),
      textTransform: 'uppercase',
    },
    placeholderSection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderText: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(14),
    },
    calendarSection: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 24,
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    calendarTitle: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(16),
      textTransform: 'capitalize',
    },
    calendarNavButton: {
      padding: 6,
    },
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    weekLabel: {
      width: '14.2%',
      textAlign: 'center',
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(10),
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    calendarCell: {
      width: '13.9%',
      minHeight: 64,
      borderRadius: 14,
      padding: 6,
      backgroundColor: theme.calendarCellBg,
      borderWidth: 1,
      borderColor: theme.calendarCellBorder,
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    calendarCellEmpty: {
      width: '13.9%',
      minHeight: 64,
      borderRadius: 14,
      backgroundColor: 'transparent',
      marginBottom: 6,
    },
    calendarCellToday: {
      borderColor: 'rgba(255,255,255,0.4)',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    calendarCellSelected: {
      borderColor: colors.lavender,
    },
    calendarDay: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(12),
    },
    calendarZodiac: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
      textAlign: 'center',
    },
    calendarMoonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    calendarMoonIcon: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#F4F1D0',
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    calendarMoonLight: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: 9,
      backgroundColor: '#F4F1D0',
    },
    calendarMoonShadow: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: 9,
      backgroundColor: 'rgba(40, 18, 60, 0.8)',
    },
    calendarMoonText: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(9),
    },
    profileContent: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 20,
    },
    profileTitle: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(22),
      marginTop: 8,
    },
    profileSection: {
      borderRadius: 18,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      padding: 16,
      gap: 12,
    },
    profileSectionTitle: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(10),
      textTransform: 'uppercase',
      letterSpacing: ls(2),
    },
    profileOptionGroup: {
      flexDirection: 'row',
      gap: 12,
    },
    profileOptionGroupWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    profileThemeButton: {
      width: '48%',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      alignItems: 'flex-start',
      gap: 8,
    },
    profileOptionButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      alignItems: 'center',
    },
    profileOptionButtonActive: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderColor: theme.cardBorder,
    },
    profileOptionButtonText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
    },
    themePreviewRow: {
      flexDirection: 'row',
      gap: 6,
    },
    themeSwatch: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    profileRowLabel: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
    },
    profileRowValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    profileRowText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
    },
  bannerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    paddingHorizontal: 0,
  },
  rateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 4, 8, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  rateSheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 26,
    backgroundColor: theme.modalBg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 22,
    paddingBottom: 24,
  },
  rateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(224,176,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224,176,255,0.3)',
  },
  rateHeaderText: {
    flex: 1,
  },
  rateTitle: {
    color: colors.white,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: fs(18),
  },
  rateSubtitle: {
    color: colors.whiteMuted,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: fs(11),
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: ls(1.2),
  },
  rateBody: {
    color: colors.whiteSoft,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: fs(13),
    lineHeight: fs(18),
  },
  rateActionsColumn: {
    marginTop: 18,
    gap: 10,
  },
  rateButton: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateButtonPrimary: {
    backgroundColor: colors.lavender,
  },
  rateButtonPrimaryText: {
    color: colors.charcoal,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: fs(12),
    textTransform: 'uppercase',
    letterSpacing: ls(1.2),
  },
  rateButtonGhost: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  rateButtonGhostText: {
    color: colors.whiteSoft,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: fs(12),
  },
  rateButtonOutline: {
    borderWidth: 1,
    borderColor: 'rgba(230,230,250,0.4)',
  },
  rateButtonOutlineText: {
    color: colors.lavender,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: fs(12),
  },
  moreAppsSection: {
    marginTop: 6,
  },
  moreAppsLabel: {
    color: colors.whiteMuted,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: fs(11),
    textTransform: 'uppercase',
    letterSpacing: ls(1.4),
    marginBottom: 10,
  },
  moreAppsList: {
    paddingRight: 12,
  },
  moreAppCard: {
    width: 86,
    marginRight: 12,
    alignItems: 'center',
  },
  moreAppIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  moreAppIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  moreAppName: {
    color: colors.whiteSoft,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: fs(10),
    textAlign: 'center',
  },
    profileField: {
      gap: 6,
    },
    profileInput: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.white,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
    },
    profileSaveButton: {
      marginTop: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.jade,
    },
    profileSaveButtonText: {
      color: '#0A0A0A',
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(12),
      textTransform: 'uppercase',
      letterSpacing: ls(1.2),
    },
    customCityEmpty: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
    },
    customCityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    customCityInfo: {
      flex: 1,
      paddingRight: 12,
    },
    customCityName: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(13),
    },
    customCityCoords: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(11),
    },
    customCityActions: {
      flexDirection: 'row',
      gap: 8,
    },
    customCityAction: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    customCityActionText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(10),
    },
    reminderControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    reminderButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderTimeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    reminderTimeText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
      minWidth: 60,
      textAlign: 'center',
    },
    reminderPickerWrap: {
      marginTop: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.2)',
      padding: 8,
    },
    reminderDone: {
      marginTop: 8,
      alignSelf: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    reminderDoneText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(11),
    },
    profileActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    profileRow: {
      paddingVertical: 8,
    },
    profileLabel: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1.8,
    },
    profileOption: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    profileOptionActive: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 12,
      paddingHorizontal: 12,
      marginHorizontal: -12,
    },
    profileOptionText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: 14,
    },
    scrollContent: {
      paddingBottom: 36,
    },
    centerBlock: {
      paddingTop: 80,
      alignItems: 'center',
    },
    errorText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(14),
    },
    hero: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
      height: 260,
    },
    moonHaloOne: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 999,
      backgroundColor: 'rgba(139, 0, 75, 0.35)',
    },
    moonHaloTwo: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 999,
      backgroundColor: 'rgba(230, 230, 250, 0.12)',
    },
    moonSphere: {
      width: 190,
      height: 190,
      borderRadius: 95,
      backgroundColor: '#F1F1F1',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    moonSurface: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: 95,
      backgroundColor: 'rgba(255,255,255,0.6)',
    },
    moonCraterOne: {
      position: 'absolute',
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(220,220,220,0.6)',
      top: 32,
      left: 42,
    },
    moonCraterTwo: {
      position: 'absolute',
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(210,210,210,0.55)',
      bottom: 44,
      right: 36,
    },
    moonCraterThree: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: 'rgba(200,200,200,0.5)',
      top: 76,
      right: 58,
    },
    moonShadow: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 190,
      height: 190,
      borderRadius: 95,
      overflow: 'hidden',
      backgroundColor: 'rgba(9,10,18,0.6)',
    },
    moonShadowGradient: {
      flex: 1,
    },
    centerColumn: {
      paddingHorizontal: 24,
      alignItems: 'center',
    },
    phaseTitle: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(28),
      marginBottom: 8,
    },
    phaseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    pillTag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.pillBg,
      borderWidth: 1,
      borderColor: theme.pillBorder,
    },
    pillText: {
      color: colors.lavender,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(10),
      letterSpacing: ls(2),
      textTransform: 'uppercase',
    },
    phaseHint: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 16,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    chevronButton: {
      padding: 4,
    },
    dateText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(14),
      letterSpacing: ls(0.4),
    },
    infoCard: {
      width: '100%',
      marginTop: 18,
      borderRadius: 18,
      padding: 16,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
      paddingBottom: 8,
      marginBottom: 10,
    },
    infoValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    infoLabel: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
    },
    infoValue: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
    },
    infoStack: {
      alignItems: 'center',
      gap: 4,
    },
    lunarDayRanges: {
      marginTop: 8,
      gap: 10,
      width: '100%',
    },
    lunarDayRangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    lunarDayRangeRowActive: {
      backgroundColor: theme.pillBg,
      borderColor: theme.pillBorder,
    },
    lunarDayRangeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.pillBg,
      borderWidth: 1,
      borderColor: theme.pillBorder,
    },
    lunarDayRangeNumber: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(12),
    },
    lunarDayRangeLabel: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(10),
      letterSpacing: ls(0.3),
    },
    lunarDayRangeColumn: {
      flex: 1,
      alignItems: 'flex-end',
      gap: 4,
    },
    lunarDayRangeText: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(11),
      textAlign: 'right',
    },
    lunarDayRangeTextActive: {
      color: colors.white,
    },
    infoHint: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(10),
      letterSpacing: ls(2),
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    notesCard: {
      width: '100%',
      marginTop: 18,
      borderRadius: 18,
      padding: 16,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      gap: 12,
    },
    notesHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    notesTitle: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(16),
    },
    notesTitleLarge: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(22),
    },
    notesSubtitle: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(11),
    },
    notesLink: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    notesLinkText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(10),
      textTransform: 'uppercase',
      letterSpacing: ls(1.2),
    },
    notesInput: {
      minHeight: 90,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.white,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
      textAlignVertical: 'top',
    },
    notesActions: {
      flexDirection: 'row',
      gap: 10,
    },
    notesExportRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    notesPrimaryButton: {
      flex: 1,
      backgroundColor: colors.jade,
      paddingVertical: 10,
      borderRadius: 14,
      alignItems: 'center',
    },
    notesPrimaryText: {
      color: '#0A0A0A',
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(12),
      textTransform: 'uppercase',
      letterSpacing: ls(1.2),
    },
    notesGhostButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
    },
    notesGhostText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
    },
    notesButtonDisabled: {
      opacity: 0.5,
    },
    notesError: {
      color: '#FF9A9A',
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(11),
    },
    notesContent: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 16,
    },
    notesHeader: {
      marginTop: 8,
      gap: 4,
    },
    notesListSection: {
      gap: 12,
    },
    noteItem: {
      borderRadius: 16,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      padding: 14,
      gap: 8,
    },
    noteItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    noteItemTitle: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(13),
    },
    noteItemEdit: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(10),
      textTransform: 'uppercase',
      letterSpacing: ls(1.2),
    },
    noteItemBody: {
      color: colors.whiteSoft,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
      lineHeight: fs(18),
    },
    influenceSection: {
      paddingHorizontal: 24,
      marginTop: 26,
      gap: 12,
    },
    sectionLabel: {
      color: theme.sectionLabel,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(10),
      letterSpacing: ls(2.4),
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    influenceCard: {
      borderRadius: 18,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      padding: 16,
      gap: 12,
    },
    influenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    influenceIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    influenceTitle: {
      flex: 1,
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(14),
    },
    influenceChevron: {
      transform: [{ rotate: '0deg' }],
    },
    influenceChevronOpen: {
      transform: [{ rotate: '180deg' }],
    },
    influenceText: {
      color: colors.whiteSoft,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
      lineHeight: fs(18),
    },
    influenceLinkWrap: {
      marginTop: 10,
    },
    influenceLinkText: {
      color: '#E0B0FF',
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
      textDecorationLine: 'underline',
    },
    lockedCard: {
      opacity: 0.8,
    },
    lockedText: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
    },
    lockedButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    lockedButtonText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(11),
      textTransform: 'uppercase',
      letterSpacing: ls(1.2),
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.modalBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    modalTitle: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(18),
    },
    searchInput: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.white,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
      marginBottom: 12,
    },
    cityList: {
      paddingBottom: 12,
    },
    cityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    cityName: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(14),
    },
    emptyText: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
      textAlign: 'center',
      paddingVertical: 24,
    },
    paywallBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    paywallSheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 32,
    },
    paywallHeader: {
      alignItems: 'center',
      gap: 6,
      marginBottom: 20,
    },
    paywallTitle: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(22),
    },
    paywallSubtitle: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_400Regular',
      fontSize: fs(12),
      textAlign: 'center',
    },
    paywallList: {
      gap: 10,
      marginBottom: 24,
    },
    paywallRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    paywallText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
    },
    paywallActions: {
      gap: 10,
    },
    paywallPrimary: {
      backgroundColor: colors.jade,
      paddingVertical: 12,
      borderRadius: 16,
      alignItems: 'center',
    },
    paywallPrimaryText: {
      color: '#0A0A0A',
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: fs(13),
      textTransform: 'uppercase',
      letterSpacing: ls(1.2),
    },
    paywallSecondary: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingVertical: 12,
      borderRadius: 16,
      alignItems: 'center',
    },
    paywallSecondaryText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
    },
    paywallButtonDisabled: {
      opacity: 0.6,
    },
    paywallTertiary: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    paywallTertiaryText: {
      color: colors.whiteMuted,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(11),
    },
    snackbar: {
      position: 'absolute',
      left: 24,
      right: 24,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: 'rgba(15, 15, 24, 0.92)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
    },
    snackbarText: {
      color: colors.white,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: fs(12),
    },
  });
};
