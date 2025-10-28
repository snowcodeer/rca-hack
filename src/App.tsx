import { useState, useEffect } from 'react'
import AnoAI from './components/ui/animated-shader-background'

function App() {
  const [showMainContent, setShowMainContent] = useState(false)
  const [isAnimationComplete, setIsAnimationComplete] = useState(false)

  const handleClick = () => {
    if (isAnimationComplete) {
      setShowMainContent(true)
    }
  }

  useEffect(() => {
    // Enable clicking after creator names appear (2s + 0.5s delay = 2.5s)
    const timer = setTimeout(() => {
      setIsAnimationComplete(true)
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (showMainContent) {
      // Hide the React app
      const rootElement = document.getElementById('root')
      if (rootElement) {
        rootElement.style.display = 'none'
      }
      
      // Show the Three.js solar system elements
      const canvas = document.querySelector('canvas.webgl')
      const btnGroup = document.querySelector('.btn-group')
      const caption = document.querySelector('.caption')
      
      if (canvas) {
        canvas.style.display = 'block'
        canvas.style.position = 'fixed'
        canvas.style.top = '0'
        canvas.style.left = '0'
        canvas.style.outline = 'none'
      }
      if (btnGroup) {
        btnGroup.style.display = 'flex'
      }
      if (caption) {
        caption.style.display = 'flex'
        caption.style.position = 'fixed'
        caption.style.bottom = '20px'
        caption.style.left = '50%'
        caption.style.transform = 'translateX(-50%)'
        caption.style.zIndex = '100'
      }
      
      // Load the original solar system script
      import('./script').then(() => {
        console.log('Solar system script loaded successfully')
      }).catch((error) => {
        console.error('Failed to load solar system script:', error)
      })
    }
  }, [showMainContent])

  if (showMainContent) {
    return null // The original Three.js app will take over
  }

  return (
    <div 
      className={`relative w-full h-screen overflow-hidden bg-black ${isAnimationComplete ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={handleClick}
    >
      {/* Animated Shader Background */}
      <AnoAI />
      
      {/* Landing Page Content */}
      <div className="centered-content z-20">
        <div className="text-center text-white">
          <h1 className="text-6xl font-bold mb-4 opacity-0 animate-fade-in-1">
            COSMØN
          </h1>
          <p className="mb-8">
            <span className="font-light opacity-0 animate-fade-in-2">created by</span>
            <br />
            <span className="opacity-0 animate-fade-in-3">Natalie Chan, Savva Bojko, and Nick Malozemov</span>
          </p>
          
          
          {/* Loading Circle */}
          <div className="mt-16 flex justify-center opacity-0 animate-fade-in-5">
            <div className="w-20 h-20 rounded-full overflow-hidden border-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
                className="scale-[3.5] animate-spin"
                style={{ animationDuration: '2s' }}
              >
                <circle style={{ fill: '#fff5b1' }} cx="256" cy="256" r="153.921" />
                <circle style={{ fill: '#ffeb64' }} cx="256" cy="256" r="102.614" />
                <path
                  d="M256 145.37c-61.002 0-110.63 49.629-110.63 110.63S194.998 366.63 256 366.63 366.63 317.002 366.63 256 317.002 145.37 256 145.37zm0 205.227c-52.161 0-94.597-42.436-94.597-94.597s42.436-94.597 94.597-94.597 94.597 42.436 94.597 94.597-42.436 94.597-94.597 94.597zM67.34 256a8.017 8.017 0 0 0-8.017-8.017H8.017a8.017 8.017 0 0 0 0 16.034h51.307A8.017 8.017 0 0 0 67.34 256zM147.539 353.123l-60.465 60.465a8.016 8.016 0 0 0 0 11.337 7.988 7.988 0 0 0 5.668 2.348 7.988 7.988 0 0 0 5.668-2.348l60.465-60.465a8.016 8.016 0 0 0 0-11.337 8.015 8.015 0 0 0-11.336 0zM413.589 87.074l-60.465 60.465a8.016 8.016 0 0 0 0 11.337 7.988 7.988 0 0 0 5.668 2.348 7.988 7.988 0 0 0 5.668-2.348l60.465-60.465a8.016 8.016 0 0 0 0-11.337 8.013 8.013 0 0 0-11.336 0zM393.353 256a8.017 8.017 0 0 0 8.017 8.017h17.102a8.017 8.017 0 0 0 0-16.034H401.37a8.017 8.017 0 0 0-8.017 8.017zM118.647 256a8.017 8.017 0 0 0-8.017-8.017H93.528a8.017 8.017 0 0 0 0 16.034h17.102a8.017 8.017 0 0 0 8.017-8.017zM503.983 247.983h-51.307a8.017 8.017 0 0 0 0 16.034h51.307a8.017 8.017 0 0 0 0-16.034zM256 118.647a8.017 8.017 0 0 0 8.017-8.017V93.528a8.017 8.017 0 0 0-16.034 0v17.102a8.017 8.017 0 0 0 8.017 8.017zM256 67.34a8.017 8.017 0 0 0 8.017-8.017V8.017a8.017 8.017 0 0 0-16.034 0v51.307A8.017 8.017 0 0 0 256 67.34zM256 393.353a8.017 8.017 0 0 0-8.017 8.017v17.102a8.017 8.017 0 0 0 16.034 0V401.37a8.017 8.017 0 0 0-8.017-8.017zM256 444.66a8.017 8.017 0 0 0-8.017 8.017v51.307a8.017 8.017 0 0 0 16.034 0v-51.307A8.017 8.017 0 0 0 256 444.66zM147.539 158.877a7.988 7.988 0 0 0 5.668 2.348 7.988 7.988 0 0 0 5.668-2.348 8.016 8.016 0 0 0 0-11.337L98.411 87.074a8.014 8.014 0 0 0-11.337 0 8.016 8.016 0 0 0 0 11.337l60.465 60.466zM364.461 353.123a8.016 8.016 0 0 0-11.337 0 8.016 8.016 0 0 0 0 11.337l60.465 60.465c1.565 1.566 3.617 2.348 5.668 2.348s4.103-.782 5.668-2.348a8.016 8.016 0 0 0 0-11.337l-60.464-60.465zM105.898 326.194a8 8 0 0 0 3.065-.612l15.8-6.545a8.016 8.016 0 1 0-6.135-14.813l-15.8 6.545a8.016 8.016 0 0 0-4.339 10.474 8.017 8.017 0 0 0 7.409 4.951zM71.227 323.858l-15.8 6.545a8.016 8.016 0 1 0 6.136 14.813l15.8-6.545a8.016 8.016 0 1 0-6.136-14.813zM437.709 188.754a8.018 8.018 0 0 0 3.065-.611l15.8-6.545a8.017 8.017 0 0 0-6.135-14.813l-15.8 6.545a8.016 8.016 0 0 0-4.339 10.474 8.016 8.016 0 0 0 7.409 4.95zM403.037 186.418l-15.8 6.545a8.016 8.016 0 0 0-4.339 10.474 8.018 8.018 0 0 0 10.475 4.339l15.8-6.545a8.018 8.018 0 0 0-6.136-14.813zM186.418 108.963l6.545 15.8a8.02 8.02 0 0 0 7.41 4.951 8.016 8.016 0 0 0 7.404-11.086l-6.545-15.8a8.015 8.015 0 0 0-10.474-4.339 8.016 8.016 0 0 0-4.34 10.474zM173.329 77.362a8.019 8.019 0 0 0 10.475 4.339 8.016 8.016 0 0 0 4.339-10.474l-6.545-15.8a8.017 8.017 0 0 0-14.813 6.135l6.544 15.8zM338.671 434.638a8.016 8.016 0 0 0-10.474-4.339 8.016 8.016 0 0 0-4.339 10.474l6.545 15.8a8.02 8.02 0 0 0 7.41 4.951 8.016 8.016 0 0 0 7.404-11.086l-6.546-15.8zM325.582 403.037l-6.545-15.8a8.017 8.017 0 0 0-14.813 6.135l6.545 15.8a8.019 8.019 0 0 0 10.475 4.339 8.017 8.017 0 0 0 4.338-10.474zM124.764 192.963l-15.8-6.545a8.016 8.016 0 0 0-10.474 4.339 8.016 8.016 0 0 0 4.339 10.474l15.8 6.545a7.985 7.985 0 0 0 3.065.612 8.02 8.02 0 0 0 7.41-4.951 8.019 8.019 0 0 0-4.34-10.474zM77.362 173.329l-15.8-6.545c-4.092-1.694-8.78.248-10.474 4.339s.248 8.78 4.339 10.474l15.8 6.545a8.02 8.02 0 0 0 10.475-4.34 8.016 8.016 0 0 0-4.34-10.473zM456.574 330.402l-15.8-6.545a8.016 8.016 0 0 0-10.474 4.34 8.016 8.016 0 0 0 4.339 10.474l15.8 6.545a7.989 7.989 0 0 0 3.065.612 8.02 8.02 0 0 0 7.41-4.951 8.02 8.02 0 0 0-4.34-10.475zM387.236 319.037l15.8 6.545a7.985 7.985 0 0 0 3.065.612 8.02 8.02 0 0 0 7.41-4.951 8.016 8.016 0 0 0-4.339-10.474l-15.8-6.545a8.017 8.017 0 0 0-6.136 14.813zM308.563 129.102a7.985 7.985 0 0 0 3.065.612 8.02 8.02 0 0 0 7.41-4.951l6.545-15.8a8.016 8.016 0 0 0-4.339-10.474 8.015 8.015 0 0 0-10.474 4.339l-6.545 15.8a8.015 8.015 0 0 0 4.338 10.474zM328.196 81.701a8.019 8.019 0 0 0 10.475-4.339l6.545-15.8a8.016 8.016 0 1 0-14.813-6.135l-6.545 15.8a8.017 8.017 0 0 0 4.338 10.474zM183.804 430.299a8.016 8.016 0 0 0-10.474 4.339l-6.545 15.8a8.016 8.016 0 0 0 7.404 11.086 8.02 8.02 0 0 0 7.41-4.951l6.545-15.8a8.02 8.02 0 0 0-4.34-10.474zM203.437 382.898a8.015 8.015 0 0 0-10.474 4.339l-6.545 15.8a8.016 8.016 0 0 0 7.404 11.086 8.02 8.02 0 0 0 7.41-4.951l6.545-15.8a8.017 8.017 0 0 0-4.34-10.474z"
                />
              </svg>
            </div>
          </div>
          
          {/* Click to Continue - Only show when animations are complete */}
          {isAnimationComplete && (
            <div className="mt-8 opacity-0 animate-fade-in-6">
              <p className="text-sm font-light animate-pulse">Click anywhere to continue</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
