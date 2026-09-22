import { useEffect, useRef } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import 'ol/ol.css'
import './App.css'

function App() {
  const mapElementRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mapElementRef.current) {
      return
    }

    const map = new Map({
      target: mapElementRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: [1170000, 6590000],
        zoom: 5.5,
      }),
    })

    return () => map.setTarget(undefined)
  }, [])

  return (
    <main className="app">
      <header className="app-header">
        <h1>Deutschland Wetterkarte (V1)</h1>
        <p>Projektinitialisierung: React + TypeScript + Vite + OpenLayers</p>
      </header>
      <section className="map-panel">
        <div ref={mapElementRef} className="map-root" />
      </section>
    </main>
  )
}

export default App
