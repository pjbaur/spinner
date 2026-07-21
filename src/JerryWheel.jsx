import { useEffect, useState } from 'react'
import AssignmentWheel from './AssignmentWheel.jsx'
import AssignmentMemo from './AssignmentMemo.jsx'
import { createAssignmentSound } from './assignmentSound.js'
import {
  genFileNumber,
  nextWeekday,
  formatEffective,
} from './jerryWheelMath.js'
import './JerryWheel.css'

const ENVIRONMENTS = [
  'Kindergarten',
  'Grade School',
  'Middle School',
  'After School',
  'School Bus',
  'Summer School',
]
const SUBJECTS = [
  'P.E.',
  'Nap-Time Patrol',
  'Cafeteria Duty',
  'Potty Rotation',
  'Shop Class',
  'Testing Prep',
]
const ENV_COLORS = ['#25392d', '#31503c']
const TOPIC_COLORS = ['#23232b', '#33333f']

export default function JerryWheel({ teacherName = 'Jerry', soundOn = true }) {
  const [result, setResult] = useState({ env: null, topic: null, fileNo: null })
  const [muted, setMuted] = useState(!soundOn)

  const [sound] = useState(() => createAssignmentSound())
  useEffect(() => {
    sound.setEnabled(!muted)
  }, [muted, sound])

  const bothDone = result.env != null && result.topic != null

  useEffect(() => {
    if (bothDone) sound.stamp()
  }, [bothDone, sound])

  function handleSpinEnd(axis, index) {
    const candidateFileNo = genFileNumber()
    setResult((r) => {
      const next = { ...r, [axis]: index }
      if (next.env != null && next.topic != null && next.fileNo == null) {
        next.fileNo = candidateFileNo
      }
      return next
    })
  }

  function handleReset() {
    setResult({ env: null, topic: null, fileNo: null })
  }

  const effectiveDate = formatEffective(nextWeekday(new Date()))

  return (
    <div className="jerry">
      <div className="jerry__grain" aria-hidden="true" />
      <div className="jerry__content">
        <button
          type="button"
          className="jerry__mute"
          aria-label="Toggle sound"
          onClick={() => setMuted((m) => !m)}
        >
          SOUND: {muted ? 'OFF' : 'ON'}
        </button>

        <div className="jerry__banner">
          <div className="jerry__title">
            What will {teacherName} teach next?
          </div>
          <div className="jerry__subtitle">
            OFFICE OF SUBSTITUTE PLACEMENT &nbsp;·&nbsp; SPIN BOTH WHEELS TO
            RECEIVE TODAY&apos;S ASSIGNMENT
          </div>
        </div>

        <div className="jerry__wheels">
          <AssignmentWheel
            title="TEACHING ENVIRONMENT"
            labels={ENVIRONMENTS}
            colors={ENV_COLORS}
            hasResult={result.env != null}
            sound={sound}
            onSpinEnd={(index) => handleSpinEnd('env', index)}
          />
          <AssignmentWheel
            title="TEACHING SUBJECT"
            labels={SUBJECTS}
            colors={TOPIC_COLORS}
            hasResult={result.topic != null}
            sound={sound}
            onSpinEnd={(index) => handleSpinEnd('topic', index)}
          />
        </div>

        <div className="jerry__result" role="status" aria-live="polite">
          {!bothDone && (
            <div className="jerry__awaiting">
              — awaiting results of both wheels —
            </div>
          )}
          {bothDone && (
            <AssignmentMemo
              teacherName={teacherName}
              subject={SUBJECTS[result.topic]}
              environment={ENVIRONMENTS[result.env]}
              effectiveDate={effectiveDate}
              fileNo={result.fileNo}
              onFileNewRequest={handleReset}
            />
          )}
        </div>

        <div className="jerry__footer">
          Assignments are final. Appeals may be filed with the vice principal,
          who is also unavailable.
        </div>
      </div>
    </div>
  )
}
