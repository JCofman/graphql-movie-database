const get = require('lodash/get')
const debug = require('../utils/debug')
const MovieDatabase = require('./MovieDatabase')
const transforms = require('../utils/transforms')

/**
 * A data source to connect to the TMDB rest API
 */
class MovieDatabaseV3 extends MovieDatabase {
  constructor() {
    super()
    this.baseURL = `https://api.themoviedb.org/3/`
  }

  /**
   * Add authentication params to V3 requests
   * @override
   */
  willSendRequest(request) {
    // api_key (application authentication )
    request.params.set('api_key', process.env.TMDB_API_KEY)
    // session_id (user authentication)
    if (this.context.sessionId) {
      request.params.set('session_id', this.context.sessionId)
    }
  }

  /**
   * Get details about a single person by ID
   * @see https://developers.themoviedb.org/3/people/get-person-details
   */
  async getPerson({ id }) {
    return this.get(`/person/${id}`, {
      appendToResponse: 'combined_credits,images'
    })
  }

  /**
   * Get the details about a single Movie by ID
   * @see https://developers.themoviedb.org/3/movies/get-movie-details
   */
  async getMovie({ id }) {
    // Includes credits, video, images, reviews
    const response = await this.get(`/movie/${id}`, {
      appendToResponse: 'credits,images,videos,reviews'
    })
    return { ...response, mediaType: 'MOVIE' }
  }

  /**
   * Get details about a single TV show by ID
   * @see https://developers.themoviedb.org/3/tv/get-tv-details
   */
  async getShow({ id }) {
    const response = await this.get(`/tv/${id}`, {
      appendToResponse: 'credits,images,videos,reviews,seasons'
    })
    return { ...response, mediaType: 'TV' }
  }

  /**
   * Get the details about a single season of a TV show
   * Includes the cast, crew, videos, review
   * @see https://developers.themoviedb.org/3/tv-seasons/get-tv-season-details
   */
  async getSeason({ showId, seasonNumber }) {
    return this.get(`/tv/${showId}/season/${seasonNumber}`, {
      appendToResponse: 'credits,images,videos,reviews'
    })
  }

  /**
   * Get a single episode of a TV show
   * @see https://developers.themoviedb.org/3/tv-episodes/get-tv-episode-details
   */
  async getEpisode({ showId, seasonNumber, episodeNumber }) {
    const path = `/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`
    return this.get(path, {
      appendToResponse: 'credits,guest_stars,images,videos,reviews'
    })
  }

  /**
   * Takes a list list of genre IDs and returns a list of genre
   * @param {'MOVIE' | 'TV'} mediaType
   */
  async getGenresById({ mediaType, ids }) {
    const genres = await this.getGenreList(mediaType)
    return ids
      .map(id => genres.find(genre => genre.id === id))
      .filter(genre => genre !== null)
  }

  /**
   * Get the list of official genres for a specific Media type
   * @param {'MOVIE' | 'TV'} mediaType
   */
  async getGenreList(mediaType) {
    const { genres } = await this.get(`genre/${mediaType}/list`)
    return genres
  }

  /** Get system configuration information */
  async getConfiguration() {
    return this.get('/configuration')
  }

  /**
   * Gets the account states of Movie or TV Show.
   *
   * @see https://developers.themoviedb.org/3/tv/get-tv-account-states
   * @see https://developers.themoviedb.org/3/movies/get-movie-account-states
   */
  async getAccountStates({ mediaType, id }) {
    // Don't cache response
    const init = { cacheOptions: { ttl: 1 } }
    return this.get(`/${mediaType}/${id}/account_states`, null, init)
  }

  /**
   * Find movies or TV shows using the Discover API. The discover api provides
   * a wide range of filtering and sorting options.
   *
   * @param {'MOVIE' | 'TV'} mediaType
   * @param {Object} [params] - query parameters for the `discover` endpoints
   * @param {number} [params.page] Must be an Int <= 1000
   * @see https://developers.themoviedb.org/3/discover/movie-discover
   */
  async discover({ mediaType, page = 1, ...params }) {
    params = this.transformSortByInput(params, mediaType)
    return this.get(`/discover/${mediaType}`, { page, ...params })
  }

  /**
   * Search for items matching the provided query.
   *
   * @param {'MOVIE' | 'SHOW' | 'PERSON' | 'COMPANY' | 'ALL'} type
   * @param {Object} params
   * @param {String} params.query the query string to search for
   * @param {number} [params.page] the pagination offset. Must be Int <= 1000
   * @see https://developers.themoviedb.org/3/search/multi-search
   */
  async search({ type, ...params }) {
    const mediaType = transforms.toMediaType(type)
    let { results, ...rest } = await this.get(`/search/${mediaType}`, params)
    if (mediaType !== 'MULTI') {
      // The  `__resolveType` function for `SearchResult` uses the mediaType
      // property, which only exists on results returned by the multi search
      // api. So when searching a single object type, we add a mediaType prop
      // to results
      results = results.map(result => ({ mediaType, ...result }))
    }
    return { results, ...rest }
  }

  /**
   * Gets account details for the logged in user.
   */
  async getAccount() {
    const init = { cacheOptions: { ttl: 0 } }
    return this.get('/account', null, init)
  }

  /**
   * Adds/removes an item from watchlist or favorites.
   *
   * @param {'favorite' | 'watchlist'} listType
   * @param {Object} params
   * @see https://developers.themoviedb.org/3/account/add-to-watchlist
   * @see https://developers.themoviedb.org/3/account/mark-as-favorite
   */
  async addToWatchlistOrFavorites(listType, { accountId, input }) {
    try {
      const path = `/account/${accountId}/${listType}`
      const body = this.transformListItemInput(input)
      const { statusMessage } = await this.post(path, body)
      return { success: true, message: statusMessage }
    } catch (error) {
      debug.error(error)
      return { message: error.message }
    }
  }

  /**
   * Adds or removes an item from the user's watchlist.
   * Requires a valid user access token.
   *
   * @param {Object} params
   * @param {Object} params.input
   * @param {string} params.input.id
   * @param {'MOVIE' | 'TV' } params.input.mediaType
   * @param {boolean} params.input.watchlist  If true, the item will be added to
   *     watchlist. Otherwise, it will be removed
   */
  addToWatchlist(params) {
    return this.addToWatchlistOrFavorites('watchlist', params)
  }

  /**
   * Adds or removes an item from the user's favorites lists.
   * Requires a valid user access token.
   *
   * @param {Object} params
   * @param {Object} params.input
   * @param {string} params.input.id
   * @param {'MOVIE' | 'TV' } params.input.mediaType
   * @param {boolean} params.input.watchlist  If true, the item will be added to
   *     watchlist. Otherwise, it will be removed
   */
  addToFavorites(params) {
    return this.addToWatchlistOrFavorites('favorite', params)
  }

  /**
   * Submit a user rating for a Movie or TV Show. Rating should be a number
   * between 0.5 and 10.0 (must be a multiple of 0.5). Setting the rating
   * to `null` will remove the user rating on this item (if there is one).
   *
   * Can only be performed by a logged in user; requires a valid user access
   * token.
   *
   * @param {Object} params
   * @param {'MOVIE' | 'TV'} params.mediaType
   * @param {string} params.id
   * @param {number | null} params.value number between 0.5 and 10.0 or `null`
   * @see https://developers.themoviedb.org/3/movies/rate-movie
   * @see https://developers.themoviedb.org/3/movies/delete-movie-rating
   */
  async updateRating({ mediaType, id, value }) {
    try {
      const path = `/${mediaType}/${id}/rating`
      // If value is `null`, delete the rating from this item
      const method = value === null ? 'delete' : 'post'
      const body = method === 'post' ? { value } : null
      const { statusMessage } = await this[method](path, body)
      return { success: true, message: statusMessage }
    } catch (error) {
      debug.error(error)
      const message = get(error, 'extensions.response.body.statusMessage')
      return { message: message || error.message }
    }
  }

  /**
   * Converts a user access token (V4 authentication) to a session ID.
   */
  async convertTokenToSessionID({ accessToken }) {
    try {
      const path = `/authentication/session/convert/4`
      const response = await this.post(path, { accessToken })
      return response
    } catch (error) {
      debug.error(error)
      return { success: false, error }
    }
  }

  async deleteSessionID() {
    try {
      const path = '/authentication/session'
      const body = { session_id: this.context.sessionId }
      return this.delete(path, null, { body })
    } catch (error) {
      return { success: false, error }
    }
  }
}
module.exports = MovieDatabaseV3
