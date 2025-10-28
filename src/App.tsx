import { useState, useEffect } from 'react'
import AnoAI from './components/ui/animated-shader-background'

function App() {
  const [showMainContent, setShowMainContent] = useState(false)
  const [isAnimationComplete, setIsAnimationComplete] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)

  const handleClick = () => {
    if (isAnimationComplete && !isFadingOut) {
      setIsFadingOut(true)
      // Wait for fade out animation to complete before showing main content
      setTimeout(() => {
        setShowMainContent(true)
      }, 1000) // 1 second fade out duration
    }
  }

  useEffect(() => {
    // Enable clicking after tagline appears (1.25s + 2s fade = 3.25s)
    const timer = setTimeout(() => {
      setIsAnimationComplete(true)
    }, 3250) // Updated delay to 3250ms

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (showMainContent) {
      // Hide the React app
      const rootElement = document.getElementById('root')
      if (rootElement) {
        rootElement.style.display = 'none'
      }
      
      // Show the Three.js solar system elements with fade-in
      const canvas = document.querySelector('canvas.webgl')
      const btnGroup = document.querySelector('.btn-group')
      const caption = document.querySelector('.caption')
      
      if (canvas) {
        canvas.style.display = 'block'
        canvas.style.position = 'fixed'
        canvas.style.top = '0'
        canvas.style.left = '0'
        canvas.style.outline = 'none'
        canvas.style.opacity = '0'
        canvas.style.transition = 'opacity 1s ease-in-out'
        // Trigger fade-in after a brief delay
        setTimeout(() => {
          canvas.style.opacity = '1'
        }, 100)
      }
      if (btnGroup) {
        btnGroup.style.display = 'flex'
        btnGroup.style.opacity = '0'
        btnGroup.style.transition = 'opacity 1s ease-in-out'
        setTimeout(() => {
          btnGroup.style.opacity = '1'
        }, 200)
      }
      if (caption) {
        caption.style.display = 'flex'
        caption.style.position = 'fixed'
        caption.style.bottom = '20px'
        caption.style.left = '50%'
        caption.style.transform = 'translateX(-50%)'
        caption.style.zIndex = '100'
        caption.style.opacity = '0'
        caption.style.transition = 'opacity 1s ease-in-out'
        setTimeout(() => {
          caption.style.opacity = '1'
        }, 300)
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
      className={`relative w-full h-screen overflow-hidden bg-black ${isAnimationComplete ? 'cursor-pointer' : 'cursor-default'} ${isFadingOut ? 'fade-out' : ''}`}
      onClick={handleClick}
    >
      {/* Animated Shader Background */}
      <AnoAI />
      
      {/* Landing Page Content */}
      <div className="centered-content z-20">
        <div className="text-center">
          {/* Main Title */}
          <h1 className="cosmon-title opacity-0 animate-fade-in-1">
            COSMØN
          </h1>
          
          {/* Tagline */}
          <p className="cosmon-tagline opacity-0 animate-fade-in-2">
            Command the cosmos with your voice and hands.
          </p>
          
          {/* Click to Continue - Always present to prevent layout shift */}
          <div className="mt-12">
            <p className="text-sm font-light animate-pulse text-white opacity-0 animate-fade-in-3">
              Click anywhere to continue
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
