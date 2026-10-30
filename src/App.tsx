import { lazy, Suspense, useEffect, useState } from 'react'
import { countView } from './analytics'
import { deptById, roomById } from './data/lookup'
import { go, routePath, useRoute } from './router'
import { parseFrom } from './state/store'
import { useAppStore } from './state/store'
import { AskButton, AssistantSheet } from './assistant/Assistant'
import { useChatStore } from './assistant/chatStore'
import { Banner, BottomBar, Chips, FloorPicker, StatusRow, TopBar, Toast } from './ui/MapChrome'
import { FromPicker } from './ui/FromPicker'
import { BackToMe, HereBanner, NearSheet } from './ui/HereScreen'
import { RoomSheet } from './ui/RoomSheet'
import { StepsCard } from './ui/StepsCard'
import { MapPlaceholder } from './ui/MapPlaceholder'
import { SearchScreen } from './ui/SearchScreen'
import { AboutScreen, DepartmentScreen, KeySheet } from './ui/Screens'

// The 3D scene (three.js) is the biggest download: it starts now, while the page is still starting, not after React mounts
// (index.html also preloads the chunk). The outline placeholder shows until the scene has drawn its first frame.
const sceneChunk = import('./scene/BuildingScene')
const BuildingScene = lazy(() => sceneChunk)

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
      if (!s.showHere(route.id)) {
        // An unknown QR id: say so and show the overview.
        s.showNotice('qrGone')
        go('/', true)
      }
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
  const route = useRoute()
  const lang = useAppStore((s) => s.lang)
  const selected = useAppStore((s) => s.selectedRoomId)
  const searchOpen = useAppStore((s) => s.searchOpen)
  const keyOpen = useAppStore((s) => s.keyOpen)
  const routing = useAppStore((s) => s.route !== null)
  const picking = useAppStore((s) => s.fromPicker !== null)
  const nearSheet = useAppStore((s) => s.hereOpen && s.here !== null)
  const [sceneReady, setSceneReady] = useState(false)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <div className={lang === 'th' ? 'app lang-th' : 'app'}>
      <MapPlaceholder done={sceneReady} />
      <Suspense fallback={null}>
        <div className={sceneReady ? 'scene-fade is-ready' : 'scene-fade'} data-scene-ready={sceneReady}>
          <BuildingScene onReady={() => setSceneReady(true)} />
        </div>
      </Suspense>
      <RouteEffects />
      <TopBar />
      <Banner />
      <HereBanner />
      <Chips />
      <StatusRow />
      <FloorPicker />
      {routing ? <StepsCard /> : selected ? <RoomSheet /> : nearSheet ? <NearSheet /> : <BottomBar />}
      <BackToMe />
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
