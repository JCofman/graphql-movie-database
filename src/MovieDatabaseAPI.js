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

  /**
   * Handles get requests
   * This overrides the `get` method on the parent class to perform some general
   * transformations to the response data that are common to all get methods.
   * It also sets cache options for all get requests. This enables partial
   * query caching for all TMDB requests.
   * @see RESTDataSource.prototype.get
   * @uses RESTDataSource.prototype.get
   */
  async get(path, params, cacheOptions = { ttl: 7200 }) {
    const init = { cacheOptions }
    // Set the cacheControl options for API responses.
    const response = camelCaseKeys(await super.get(path, params, init))
    // For single item queries, just return the item
    if (!response.results) return response
    // For multi-item endpoints, return an object with two fields:
    // - results: [Item]
    // - meta: {totalResults: Int, totalPages: Int, page: Int}
    const { results, ...meta } = response
    return { results, meta }
  }

  /** Get details about a single Movie by ID */
  async getMovie({ id }) {
    const params = { append_to_response: 'credits,images,videos,reviews' }
    return this.get(`/movie/${id}`, params)
  }

  /** Get details about a single tv show by ID */
  async getShow({ id }) {
    return this.get(`/tv/${id}`, {
      append_to_response: 'credits,images,videos,reviews,seasons'
    })
  }

  /** Get details about a single person by ID */
  async getPerson({ id }) {
    return this.get(`/person/${id}`, {
      append_to_response: 'combined_credits,images'
    })
  }

  /** Takes a list list of genre IDs and returns a list of genres */
  async getGenres({ mediaType, ids }) {
    const genres = await this.getGenreList(mediaType)
    return ids
      .map(id => genres.find(genre => genre.id === id))
      .filter(genre => genre !== null)
  }

  /**
   * Get the list of official genres for a specific Media type
   * @param {'Movie' | 'Show'} type (also accepts "show" as alias for "tv")
   */
  async getGenreList(mediaType) {
    if (!/Movie|Show/.test(mediaType)) {
      console.error(`[getGenreList] mediaType must be "Show" || "Movie"`)
    }
    const endpoint = mediaType === 'Show' ? 'tv' : 'movie'
    const { genres } = await this.get(`genre/${endpoint}/list`)
    return genres
  }

  /** Get a single season of a TV show, including all episodes */
  async getSeason({ showId, seasonNumber }) {
    return this.get(`/tv/${showId}/season/${seasonNumber}`, {
      append_to_response: 'credits,images,videos,reviews'
    })
  }

  /** Get a single season of a TV show, including all episodes */
  async getEpisode({ showId, seasonNumber, episodeNumber }) {
    const base = `/tv/${showId}/season/${seasonNumber}/episode`
    return this.get(`${base}/${episodeNumber}`, {
      append_to_response: 'credits,guest_stars,images,videos,reviews'
    })
  }

  /** Get system configuration information */
  async getConfiguration() {
    return this.get('/configuration')
  }

  /**
   * Find movies/shows using the `/discover/` endpoint
   *
   * @todo
   * Caching doesn't seem to be working on requests to `/discover/tv`.
   * If you run the `movies` query multiple times with the same args, it
   * uses the cached response from `/discover/movie` after the first
   * query. However, with the `shows` query, it looks like its making a
   * new request to `/discover/tv` on every query.
   * 1. Lean more about cache configuration options for 'RestDataSource.'
   * 2. How to get more details about the cache
   *
   * @param {'movie' | 'tv'} endpoint
   * @param {Object} params
   * @param {Object} params.filter supports all filtering options that are
   * available on the `/discover/movie` endpoint. The format of the
   * argument names is slightly different, see schema for details
   * @param {String} params.sortBy Supports all values available for the
   * `sort_by` parameter on the `/discover/movie/` endpoint. See
   * schema for details
   * @param {number} params.page Must be an Int <= 1000
   */
  async discover(endpoint, params = {}) {
    return this.get(`/discover${endpoint}`, deCamelCaseArgs(params))
  }

  /**
   * Gets movies using various `/movie/${endpoint}` methods that return
   * lists of movies.
   * @param {'NOW_PLAYING', 'UPCOMING', 'POPULAR', 'LATEST', 'TOP_RATED'} endpoint
   */
  async movies(endpoint, { page }) {
    return this.get(`/movie/${snakeCase(endpoint)}`, { page })
  }

  /**
   * Gets tv shows using various `/tv/${endpoint}` methods that return
   * lists shows.
   * @param {'ON_AIR', 'AIRING_TODAY', 'POPULAR', 'LATEST', 'TOP_RATED'} endpoint
   */
  async shows(endpoint, { page }) {
    return this.get(`/tv/${snakeCase(endpoint)}`, { page })
  }

  /**
   * Search for items matching the provided query.
   * @todo Add support for other search endpoints like `company` and `keyword`
   *
   * @param {Object} params
   * @param {'movie' | 'tv' | 'person' | 'company' | 'multi'} params.type
   * @param {String} params.query the query string to search for
   * @param {number} params.page the pagination offset. Must be Int <= 1000
   */
  async search(endpoint = '/multi', params) {
    let { results, meta } = await this.get(`/search${endpoint}`, params)
    if (/multi/.test(endpoint)) {
      results = results.map(item => ({ mediaType: endpoint.slice(1), ...item }))
    }
    return { results, meta }
  }
}
module.exports = MovieDatabaseAPI
