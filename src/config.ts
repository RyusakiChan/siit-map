/** Values the owner supplies later; leave empty to switch the feature off. */
export const config = {
  groupName: 'TU100 student group',
  /** GoatCounter site code (the part before .goatcounter.com). Empty: no script is loaded. */
  goatcounterCode: '',
  /** Link to a problem-report form. Empty: the "Report a problem" button is hidden. */
  reportUrl: '',
  /** Official SIIT page, used until each department has its own link. */
  siitUrl: 'https://www.siit.tu.ac.th/',
  /** Address of the Ask assistant Worker (see worker/README.md). Empty: the assistant is hidden. VITE_ASSISTANT_URL overrides it for local tests; dev builds without it hide the assistant, since the live Worker only allows the Pages origin. */
  assistantUrl:
    (import.meta.env.VITE_ASSISTANT_URL as string | undefined) ??
    (import.meta.env.PROD ? 'https://siit-map-ask.6922772783.workers.dev' : ''),
  buildDate: __BUILD_DATE__,
}
