import { lazy, Suspense, useEffect } from 'react'
import { countView } from './analytics'
import { deptById, roomById } from './data/lookup'
import { useT } from './i18n'
import { go, routePath, useRoute } from './router'
import { useAppStore } from './state/store'
import { AskButton, AssistantSheet } from './assistant/Assistant'
import { useChatStore } from './assistant/chatStore'
import { Banner, BottomBar, Chips, FloorPicker, StatusRow, TopBar, Toast } from './ui/MapChrome'
import { RoomSheet } from './ui/RoomSheet'
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
    if (route.name === 'room') {
      // A room opened from the assistant keeps the peek card (one-shot); links open the full card.
      const peek = useChatStore.getState().peekArrival
      useChatStore.setState({ peekArrival: false })
      if (roomById.has(route.id)) {
        s.selectRoom(route.id, { focus: true, snap: peek ? 'peek' : 'full', cross: peek })
      } else {
        s.showNotice('roomGone')
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
      <Banner />
      <Chips />
      <StatusRow />
      <FloorPicker />
      {selected ? <RoomSheet /> : <BottomBar />}
      {searchOpen && <SearchScreen />}
      {route.name === 'dept' && <DepartmentScreen id={route.id} />}
      {route.name === 'about' && <AboutScreen />}
      {keyOpen && <KeySheet />}
      <AskButton />
      <AssistantSheet />
      <Toast />
    </div>
  )
}
