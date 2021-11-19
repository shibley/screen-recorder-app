import { useEffect, useRef, useState } from 'react'
import Loader from 'react-loader-spinner'
import io from 'socket.io-client'
import './App.scss'

const SERVER_URI = 'http://localhost:4000'

let mediaRecorder = null
let dataChunks = []

function App() {
  const username = useRef(`User_${Date.now().toString().slice(-4)}`)
  const socketRef = useRef(io(SERVER_URI))
  const videoRef = useRef()
  const linkRef = useRef()

  const [screenStream, setScreenStream] = useState()
  const [voiceStream, setVoiceStream] = useState()
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      if (navigator.mediaDevices.getDisplayMedia) {
        try {
          const _screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true
          })
          setScreenStream(_screenStream)
        } catch (e) {
          console.error('*** getDisplayMedia', e)
          setLoading(false)
        }
      } else {
        console.warn('getDisplayMedia not supported')
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (navigator.mediaDevices.getUserMedia) {
        if (screenStream) {
          try {
            const _voiceStream = await navigator.mediaDevices.getUserMedia({
              audio: true
            })
            setVoiceStream(_voiceStream)
          } catch (e) {
            console.error('*** getUserMedia', e)
            if (e.message && e.message.includes('denied')) {
              setVoiceStream('denied')
            }
          } finally {
            setLoading(false)
          }
        }
      } else {
        console.warn('getUserMedia not supported')
        setLoading(false)
      }
    })()
  }, [screenStream])

  function startRecording() {
    if (socketRef.current && screenStream && voiceStream && !mediaRecorder) {
      setRecording(true)

      videoRef.current.removeAttribute('src')
      linkRef.current.removeAttribute('href')
      linkRef.current.removeAttribute('download')

      let mediaStream
      if (voiceStream === 'denied') {
        mediaStream = screenStream
      } else {
        // const audioTracks = voiceStream.getAudioTracks()
        // if (audioTracks && audioTracks.length) {
        //   audioTracks.forEach(track => {
        //     screenStream.addTrack(track)
        //   })
        // }
        // mediaStream = screenStream
        mediaStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...voiceStream.getAudioTracks()
        ])
      }

      mediaRecorder = new MediaRecorder(mediaStream)
      mediaRecorder.ondataavailable = ({ data }) => {
        dataChunks.push(data)
        socketRef.current.emit('screenData:start', {
          username: username.current,
          data
        })
      }
      mediaRecorder.onstop = stopRecording
      mediaRecorder.start(250)
    }

    function stopRecording() {
      socketRef.current.emit('screenData:end', username.current)

      const videoBlob = new Blob(dataChunks, {
        type: 'video/webm'
      })
      const videoSrc = URL.createObjectURL(videoBlob)
      videoRef.current.src = videoSrc

      linkRef.current.href = videoSrc
      linkRef.current.download = `${Date.now()}-${username.current}.webm`

      setRecording(false)
    }
  }

  const onClick = () => {
    if (!recording) {
      startRecording()
    } else {
      mediaRecorder.stop()
    }
  }

  if (loading) return <Loader type='Oval' width='60' color='#0275d8' />

  return (
    <>
      <h1>Screen Record App</h1>
      <video controls ref={videoRef}></video>
      <a ref={linkRef}>Download</a>
      <button onClick={onClick} disabled={!screenStream}>
        {!recording ? 'Start' : 'Stop'}
      </button>
    </>
  )
}

export default App