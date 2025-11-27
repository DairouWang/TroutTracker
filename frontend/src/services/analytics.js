import mixpanel from 'mixpanel-browser'

const MIXPANEL_TOKEN = '3cdea1dcd4fe1af85df5b75926c84954'

const getDeviceType = () => {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile'
  }
  if (ua.includes('ipad') || ua.includes('tablet')) {
    return 'tablet'
  }
  return 'desktop'
}

const getReferrer = () => document.referrer || 'direct'

export const initAnalytics = () => {
  mixpanel.init(MIXPANEL_TOKEN, {
    autocapture: true,
    record_sessions_percent: 100,
  })

  const distinctId = mixpanel.get_distinct_id()
  const firstSeen = window.localStorage.getItem('mixpanel_first_seen') || new Date().toISOString()
  window.localStorage.setItem('mixpanel_first_seen', firstSeen)

  const device = getDeviceType()
  const referrer = getReferrer()

  mixpanel.identify(distinctId)
  mixpanel.register_once({ first_seen: firstSeen })
  mixpanel.register({ device, referrer })
  mixpanel.people.set_once({ first_seen: firstSeen, distinct_id: distinctId })
  mixpanel.people.set({ device, referrer })

  return { distinctId, firstSeen, device, referrer }
}

export const trackPageView = (path) => {
  mixpanel.track('page_view', {
    path,
    title: document.title,
  })
}

export const trackLakeClick = (plant) => {
  if (!plant) return

  mixpanel.track('lake_clicked', {
    lake_id: plant.id,
    lake_name: plant.lake_name,
    county: plant.county,
    species: plant.species,
    stock_date: plant.stock_date,
  })

  if (plant.county) {
    mixpanel.register({ preferred_county: plant.county })
    mixpanel.people.set({ preferred_county: plant.county })
  }
}

export const trackDirectionClick = (plant) => {
  if (!plant) return

  const { coordinates = {} } = plant
  mixpanel.track('direction_button_clicked', {
    lake_id: plant.id,
    lake_name: plant.lake_name,
    county: plant.county,
    latitude: coordinates.lat,
    longitude: coordinates.lng,
  })
}

export const trackFilteredByDate = (days) => {
  mixpanel.track('filtered_by_date', {
    days: Number(days),
  })
}

export const trackFeedbackSubmitted = ({ hasName, hasEmail, messageLength }) => {
  mixpanel.track('feedback_submitted', {
    name_provided: hasName,
    email_provided: hasEmail,
    message_length: messageLength,
  })
}
