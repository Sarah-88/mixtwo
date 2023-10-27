import type { Config } from 'tailwindcss'

export default {
    content: ['./app/**/*.{js,jsx,ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                orbitron: "Orbitron, sans-serif",
                grandstander: "Grandstander, cursive",
                comfortaa: "Comfortaa, cursive"
            },
            keyframes: {
                'swingright': {
                    '0%, 100%': { transform: 'translateX(0px)' },
                    '50%': { transform: 'translateX(30px)' }
                },
                'swingleft': {
                    '0%, 100%': { transform: 'translateX(0px)' },
                    '50%': { transform: 'translateX(-30px)' }
                }
            },
            boxShadow: {
                innerdark: "inset 0 0 5px 1px rgba(0,0,0,0.2)"
            },
            animation: {
                'swingright': 'swingright 1s ease-in-out infinite',
                'swingleft': 'swingleft 1s ease-in-out infinite'
            }
        },
    },
    plugins: [],
} satisfies Config

