import './AssignmentMemo.css'

export default function AssignmentMemo({
  teacherName,
  subject,
  environment,
  effectiveDate,
  fileNo,
  onFileNewRequest,
}) {
  return (
    <div className="memo">
      <div className="memo__stamp">
        ASSIGNMENT
        <br />
        CONFIRMED
      </div>

      <div className="memo__header">
        <div className="memo__eyebrow">
          UNIFIED SUBSTITUTE DISTRICT · FORM 12-J
        </div>
        <div className="memo__title">INTERIM ASSIGNMENT NOTICE</div>
      </div>

      <div className="memo__grid">
        <div className="memo__label">SUBSTITUTE</div>
        <div className="memo__value">
          {teacherName}{' '}
          <span className="memo__redacted">[surname redacted]</span>
        </div>
        <div className="memo__label">SUBJECT</div>
        <div className="memo__value memo__value--big">{subject}</div>
        <div className="memo__label">ENVIRONMENT</div>
        <div className="memo__value memo__value--big">{environment}</div>
        <div className="memo__label">EFFECTIVE</div>
        <div>{effectiveDate}, until further notice.</div>
      </div>

      <div className="memo__note">
        Prior experience (avant-garde composition, touring musicianship,
        three-chord conviction) noted and disregarded per Policy 4.2. Report to
        the front office at 7:15 a.m. A whistle will be provided.
      </div>

      <div className="memo__footer">
        <div className="memo__file">FILE {fileNo}</div>
        <button
          type="button"
          className="memo__button"
          onClick={onFileNewRequest}
        >
          FILE NEW REQUEST
        </button>
      </div>
    </div>
  )
}
