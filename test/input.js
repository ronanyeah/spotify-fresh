'use strict'

const assert = require('assert')
const stdin  = require('mock-stdin').stdin()

const { userInput } = require('../fns.js')

const isEven = x => Number(x) % 2 === 0
const isOdd = x => Number(x) % 2 !== 0

userInput( isEven )
.then(
  res => {
    assert.equal(res, '2')
    console.log('success 1!')

    userInput( isOdd )
    .then(
      res => {
        assert.equal(res, '3')
        console.log('success 2!')
      }
    )
    .catch( console.log )

    stdin.send('2\n')
    stdin.send('4\n')
    stdin.send('3\n')
  }
)
.catch( console.log )

stdin.send('3\n')
stdin.send('5\n')
stdin.send('2\n')
