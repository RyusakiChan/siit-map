import { lazy, Suspense, useEffect } from 'react'
import { countView } from './analytics'
import { deptById, roomById } from './data/lookup'
import { useT } from './i18n'
import { go, routePath, useRoute } from './router'
import { parseFrom } from './state/store'
import { useAppStore } from './state/store'
import { AskButton, AssistantSheet } from './assistant/Assistant'
import { useChatStore } from './assistant/chatStore'
import { Banner, BottomBar, Chips, FloorPicker, StatusRow, TopBar, Toast } from './ui/MapChrome'
import { FromPicker } from './ui/FromPicker'
import { RoomSheet } from './ui/RoomSheet'
import { StepsCard } from './ui/StepsCard'
import { SearchScreen } from './ui/SearchScreen'
import { AboutScreen, DepartmentScreen, KeySheet } from './ui/Screens'

// The 3D scene (three.js) loads after the controls have rendered.
const BuildingScene = lazy(() => import('./scene/BuildingScene'))

/** Applies the hash route to the app state and counts the view. */
function RouteEffects() {
  const route = useRoute()
  const key = routePath(route)
  useEffect(() => {
    const s = useAppStore.getState()
    if (route.name !== 'route') s.clearRoute() // Back (or any other link) leaves route mode
    if (route.name === 'room') {
      // A room opened from the assistant keeps the peek card (one-shot); links open the full card.
      const peek = useChatStore.getState().peekArrival
      useChatStore.setState({ peekArrival: false })
      if (roomById.has(route.id)) {
        // Already on show (leaving route mode, or the card is open): leave the card as it is.
        if (s.selectedRoomId !== route.id) s.selectRoom(route.id, { focus: true, snap: peek ? 'peek' : 'full', cross: peek })
      } else {
        s.showNotice('roomGone')
        go('/', true)
      }
    } else if (route.name === 'route') {
      useChatStore.setState({ peekArrival: false })
      const from = parseFrom(route.from)
      if (from && roomById.has(route.to)) {
        if (!s.applyRoute(from, route.to)) go('/', true)
      } else {
        s.showNotice('routeNone')
        go('/', true)
      }
    } else if (route.name === 'at') {
      s.showHere(route.id) // an unknown QR id just leaves the normal map
    } else if (route.name === 'dept' && !deptById.has(route.id)) {
      s.showNotice('deptGone')
      go('/', true)
    }
    countView(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` already encodes the route
  }, [key])
  return null
}

export default function App() {
  const t = useT()
  const route = useRoute()
  const lang = useAppStore((s) => s.lang)
  const selected = useAppStore((s) => s.selectedRoomId)
  const searchOpen = useAppStore((s) => s.searchOpen)
  const keyOpen = useAppStore((s) => s.keyOpen)
  const banner = useAppStore((s) => s.banner)
  const routing = useAppStore((s) => s.route !== null)
  const picking = useAppStore((s) => s.fromPicker !== null)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <div className={lang === 'th' ? 'app lang-th' : 'app'}>
      <Suspense fallback={<p className="loading">{t('loading')}</p>}>
        <BuildingScene />
      </Suspense>
      <RouteEffects />
      <TopBar />
      {banner ? <Banner /> : <Chips />}
      <StatusRow />
      <FloorPicker />
      {routing ? <StepsCard /> : selected ? <RoomSheet /> : <BottomBar />}
      {searchOpen && <SearchScreen />}
      {picking && <FromPicker />}
      {route.name === 'dept' && <DepartmentScreen id={route.id} />}
      {route.name === 'about' && <AboutScreen />}
      {keyOpen && <KeySheet />}
      <AskButton />
      <AssistantSheet />
      <Toast />
    </div>
  )
}
