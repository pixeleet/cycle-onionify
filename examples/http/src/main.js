import xs from 'xstream';
import delay from 'xstream/extra/delay';
import dropRepeats from 'xstream/extra/dropRepeats';
import Cycle from '@cycle/xstream-run';
import {div, button, p, makeDOMDriver} from '@cycle/dom';
import {makeHTTPDriver} from '@cycle/http';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate'

function main(sources) {

  function Posts(sources) {
    function intent(httpSource) {
      return httpSource.select('getPosts')
        .flatten()
        .map(res => res.body)
        .map(body => ({ type: 'getPosts', payload: body }))
    }
    function model(action$) {
      const initialStateReducer$ = xs.of(posts => posts ? [...posts] : [])
      const postReducer$ = action$.filter(a => a.type === 'getPosts')
        .map(a => a.payload)
        .debug('got new post...')
        .map(posts => prevState => [...prevState, ...posts])
      return xs.merge(initialStateReducer$, postReducer$)
    }
    function view(posts$) {
      return posts$.map(posts => {
        console.log(posts)
        return div('.container', [
          div('Posts'),
          div('.posts', posts.map(post => p(post.title)))
        ])
      })
    }

    const request$ = xs.of({ url: 'https://jsonplaceholder.typicode.com/posts', category: 'getPosts' })
    const posts$ = sources.onion.state$
    const action$ = intent(sources.HTTP)
    const reducer$ = model(action$)
    const vdom$ = view(posts$)

    return {
      DOM: vdom$,
      onion: reducer$,
      HTTP: request$
    }
  }

  function Users(sources) {
    function intent(httpSource) {
      return httpSource.select('getUsers')
        .flatten()
        .map(res => res.body)
        .map(body => ({ type: 'getUsers', payload: body }))
    }
    function model(action$) {
      const initialStateReducer$ = xs.of(users => users ? [...users] : [])
      const usersReducer$ = action$.filter(a => a.type === 'getUsers')
        .map(a => a.payload)
        .debug('got users...')
        .map(users => prevState => [...prevState, ...users])
      return xs.merge(initialStateReducer$, usersReducer$)
    }
    function view(users$) {
      return users$.map(users => {
        console.log(users)
        return div('.container', [
          div('Users'),
          div('.users', users.map(user => p(user.name)))
        ])
      })
    }

    const request$ = xs.of({ url: 'https://jsonplaceholder.typicode.com/users', category: 'getUsers' })
    const posts$ = sources.onion.state$
    const action$ = intent(sources.HTTP)
    const reducer$ = model(action$)
    const vdom$ = view(posts$)

    return {
      DOM: vdom$,
      onion: reducer$,
      HTTP: request$
    }
  }

  function dumbRouter(sources) {
    const router = xs.merge(
      xs.of('posts'),
      xs.of('users').compose(delay(5000))
    )

    const pages = {
      posts: sources => isolate(Posts, 'posts')(sources),
      users: sources => isolate(Users, 'users')(sources)
    }

    const component$ = sources.router
      .compose(dropRepeats())
      .map(route => pages[route])
      .map(component => component(sources))
      .debug('sinks')
      .remember()

    /* This doesn't work */

    const sinks = {
      HTTP: component$.map(component => component.HTTP).flatten(),
      DOM: component$.map(component => component.DOM).flatten().startWith(div('loading...')),
      onion: component$.map(component => component.onion).flatten(),
      router
    }

    /* This does work */

    // const sinks = {
    //   DOM: component$.map(component => component.DOM).flatten().startWith(div('loading...')),
    //   onion: component$.map(component => component.onion).flatten(),
    //   HTTP: component$.map(component => component.HTTP).flatten(),
    //   router
    // }

    return sinks
  }

  return isolate(dumbRouter)(sources)
}

const wrappedMain = onionify(main);

Cycle.run(wrappedMain, {
  DOM: makeDOMDriver('#main-container'),
  HTTP: makeHTTPDriver(),
  router: router$ => router$.debug('routeChanged').startWith('posts')
});
