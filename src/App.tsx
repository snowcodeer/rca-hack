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
    // Hide hand tracking and voice UI elements on landing page
    const handStatus = document.getElementById('hand-status');
    const handHelp = document.getElementById('hand-help');
    const voiceFeedback = document.getElementById('voice-feedback');
    
    if (handStatus) {
      (handStatus as HTMLElement).style.display = 'none';
    }
    if (handHelp) {
      (handHelp as HTMLElement).style.display = 'none';
    }
    if (voiceFeedback) {
      voiceFeedback.setAttribute('hidden', 'true');
    }
    
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
        (canvas as HTMLElement).style.display = 'block'
        ;(canvas as HTMLElement).style.position = 'fixed'
        ;(canvas as HTMLElement).style.top = '0'
        ;(canvas as HTMLElement).style.left = '0'
        ;(canvas as HTMLElement).style.outline = 'none'
        ;(canvas as HTMLElement).style.opacity = '0'
        ;(canvas as HTMLElement).style.transition = 'opacity 1s ease-in-out'
        // Trigger fade-in after a brief delay
        setTimeout(() => {
          ;(canvas as HTMLElement).style.opacity = '1'
        }, 100)
      }
      if (btnGroup) {
        ;(btnGroup as HTMLElement).style.display = 'flex'
        ;(btnGroup as HTMLElement).style.opacity = '0'
        ;(btnGroup as HTMLElement).style.transition = 'opacity 1s ease-in-out'
        setTimeout(() => {
          ;(btnGroup as HTMLElement).style.opacity = '1'
        }, 200)
      }
      if (caption) {
        ;(caption as HTMLElement).style.display = 'flex'
        ;(caption as HTMLElement).style.position = 'fixed'
        ;(caption as HTMLElement).style.bottom = '20px'
        ;(caption as HTMLElement).style.left = '50%'
        ;(caption as HTMLElement).style.transform = 'translateX(-50%)'
        ;(caption as HTMLElement).style.zIndex = '100'
        ;(caption as HTMLElement).style.opacity = '0'
        ;(caption as HTMLElement).style.transition = 'opacity 1s ease-in-out'
        setTimeout(() => {
          ;(caption as HTMLElement).style.opacity = '1'
        }, 300)
      }
      
      // Hide all tooltips before loading the solar system
      const allTooltips = [
        'space-tooltip', 'mercury-tooltip', 'venus-tooltip', 'earth-tooltip', 'moon-tooltip',
        'mars-tooltip', 'jupiter-tooltip', 'saturn-tooltip', 'uranus-tooltip', 'neptune-tooltip',
        'ganymede-tooltip', 'titan-tooltip', 'callisto-tooltip', 'io-tooltip', 'europa-tooltip', 'triton-tooltip'
      ];
      
      allTooltips.forEach(tooltipId => {
        const tooltip = document.getElementById(tooltipId);
        if (tooltip) {
          tooltip.classList.remove('show');
          tooltip.style.display = 'none';
        }
      });
      
      // Hide hand tracking and voice UI elements
      const handStatus = document.getElementById('hand-status');
      const handHelp = document.getElementById('hand-help');
      const voiceFeedback = document.getElementById('voice-feedback');
      
      if (handStatus) {
        (handStatus as HTMLElement).style.display = 'none';
      }
      if (handHelp) {
        (handHelp as HTMLElement).style.display = 'none';
      }
      if (voiceFeedback) {
        voiceFeedback.setAttribute('hidden', 'true');
      }
      
      // Load the original solar system script
      import('./script').then(() => {
        console.log('Solar system script loaded successfully')
        
        // Show sun tooltip after solar system is loaded
        setTimeout(() => {
          const sunTooltip = document.getElementById('space-tooltip');
          if (sunTooltip) {
            sunTooltip.style.display = 'block';
            setTimeout(() => {
              sunTooltip.classList.add('show');
            }, 100);
          }
        }, 500);
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
