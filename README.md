# A better DCFC calculator
A DCFC charging calculator that takes the vehicle charging curve into account. Includes ability to define custom vehicles, compare across single sessions and over a road trip, and leaderboard functionalities. Uses data from EVKX.net. Hosted at https://better-dcfc-calculator.vercel.app/

# Building the project
Generate the project files:
```
python create_project.py 
```
Build the project:
```
cd ev-caclculator
npm install
npm run build
```
Preview the project locally:
```
npm run preview
```
Refresh database:
```
python evkx_scraper.py
```
Be sure to copy/paste the .db file generated to ev-calculator/public
