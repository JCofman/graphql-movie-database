const { RESTDataSource } = require('apollo-datasource-rest')
const { camelCaseKeys, deCamelCaseArgs } = require('./utils/camelCase')
const snakeCase = require('lodash/snakeCase')
/**
 * A data source to connect to the TMDB rest API
 */
class MovieDatabaseAPI extends RESTDataSource {
  constructor() {
    super()
    this.baseURL = `https://api.themoviedb.org/3`
  }

  willSendRequest(request) {
    // Attach API key to all outgoing requests
    request.params.set('api_key', process.env.TMDB_API_KEY)
  }

  async get(path, params, init) {
    if (init === undefined) {
      // Set cache options for partial query caching.
      init = { cacheOptions: { ttl: 10000 } }
    }
    return camelCaseKeys(await super.get(path, params, init))
  }

  /**
   * Get details about a single person by ID
   * @see https://developers.themoviedb.org/3/people/get-person-details
   */
  async getPerson({ id }) {
    return this.get(`/person/${id}`, {
      append_to_response: 'combined_credits,images'
    })
  }

  /**
   * Get the details about a single Movie by ID
   * @see https://developers.themoviedb.org/3/movies/get-movie-details
   */
  async getMovie({ id }) {
    // Includes credits, video, images, reviews
    return this.get(`/movie/${id}`, {
      append_to_response: 'credits,images,videos,reviews'
    })
  }

  /**
   * Get details about a single TV show by ID
   * @see https://developers.themoviedb.org/3/tv/get-tv-details
   */
  async getShow({ id }) {
    return this.get(`/tv/${id}`, {
      append_to_response: 'credits,images,videos,reviews,seasons'
    })
  }

  /**
   * Get the details about a single season of a TV show
   * Includes the cast, crew, videos, review
   * @see https://developers.themoviedb.org/3/tv-seasons/get-tv-season-details
   */
  async getSeason({ showId, seasonNumber }) {
    return this.get(`/tv/${showId}/season/${seasonNumber}`, {
      append_to_response: 'credits,images,videos,reviews'
    })
  }

  /**
   * Get a single episode of a TV show
   * @see https://developers.themoviedb.org/3/tv-episodes/get-tv-episode-details
   */
  async getEpisode({ showId, seasonNumber, episodeNumber }) {
    const URL = `/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`
    return this.get(URL, {
      append_to_response: 'credits,guest_stars,images,videos,reviews'
    })
  }

  /** Takes a list list of genre IDs and returns a list of genre*/
  async getGenresById({ mediaType, ids }) {
    const genres = await this.getGenreList(mediaType)
    return ids
      .map(id => genres.find(genre => genre.id === id))
      .filter(genre => genre !== null)
  }

  /**
   * Get the list of official genres for a specific Media type
   * @param {'Movie' | 'Show'} mediaType
   */
  async getGenreList(mediaType) {
    if (!/Movie|Show/.test(mediaType)) {
      console.error(`[getGenreList] mediaType must be "Show" || "Movie"`)
    }
    const endpoint = mediaType === 'Show' ? 'tv' : 'movie'
    const { genres } = await this.get(`genre/${endpoint}/list`)
    return genres
  }

  /** Get system configuration information */
  async getConfiguration() {
    return this.get('/configuration')
  }

  /**
   * Find movies or TV shows using the Discover API. The discover api provides
   * a wide range of filtering and sorting options.
   *
   * @param {'/movie' | '/tv'} endpoint
   * @param {Object} [params] - query parameters for the `discover` endpoints
   * @param {number} [params.page] Must be an Int <= 1000
   * @see https://developers.themoviedb.org/3/discover/movie-discover
   */
  async discover(endpoint, params = {}) {
    return this.get(`/discover${endpoint}`, deCamelCaseArgs(params))
  }

  /**
   * Search for items matching the provided query.
   *
   * @param {'/movie' | '/tv' | '/person' | '/company' | '/multi'} endpoint
   * @param {Object} params
   * @param {String} params.query the query string to search for
   * @param {number} [params.page] the pagination offset. Must be Int <= 1000
   * @see https://developers.themoviedb.org/3/search/multi-search
   */
  async search(endpoint = '/multi', params) {
    return this.get(`/search${endpoint}`, params)
  }

  /**
   * This method gets movies using the various `/movie/<endpoint>` methods that
   * return specific lists of movies. This includes the following API endpoints:
   * - `/movie/latest`
   * - `/movie/now_playing`
   * - `/movie/now_playing`
   * - `/movie/popular`
   * - `/movie/top_rated`
   * - `/movie/upcoming`
   *
   * @param {String} endpoint
   * @param {Object} params
   * @param {number} params.page
   */
  async movies(endpoint, { page }) {
    return this.get(`/movie/${snakeCase(endpoint)}`, { page })
  }

  /**
   * Gets TV shows using the various `/tv/{endpoint}` methods. These return
   * specific lists of TV shows. It includes the following endpoints:
   *
   * - `/tv/latest`
   * - `/tv/airing_today`
   * - `/tv/on_the_air`
   * - `/tv/popular`
   * - `/tv/top_rated`
   *
   * @param {String} endpoint
   * @param {Object} params
   * @param {number} params.page
   */
  async shows(endpoint, { page }) {
    return this.get(`/tv/${snakeCase(endpoint)}`, { page })
  }
}
module.exports = MovieDatabaseAPI
